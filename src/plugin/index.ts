/**
 * FixHive OpenCode Plugin
 * Community-based error knowledge sharing plugin for OpenCode
 */

import type { Plugin } from '@opencode-ai/plugin';
import { ErrorDetector } from '../core/error-detector.js';
import { PrivacyFilter, createFilterContext } from '../core/privacy-filter.js';
import { LocalStore } from '../storage/local-store.js';
import { CloudClient } from '../cloud/client.js';
import { generateErrorFingerprint } from '../core/hash.js';
import { createTools } from './tools.js';
import type { FixHiveContext, Language, FixHiveConfig } from '../types/index.js';

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Partial<FixHiveConfig> = {
  cacheExpirationMs: 3600000, // 1 hour
  embeddingModel: 'text-embedding-3-small',
  embeddingDimensions: 1536,
  similarityThreshold: 0.7,
  maxSearchResults: 10,
};

/**
 * FixHive Plugin Factory
 */
export const FixHivePlugin: Plugin = async (ctx) => {
  // Load configuration from environment
  const config = loadConfig();

  // Initialize components
  const privacyFilter = new PrivacyFilter();
  const filterContext = createFilterContext(ctx.directory);
  const errorDetector = new ErrorDetector(privacyFilter);
  const localStore = new LocalStore(ctx.directory);

  // Initialize cloud client if configured
  let cloudClient: CloudClient | null = null;
  if (config.supabaseUrl && config.supabaseAnonKey) {
    cloudClient = new CloudClient({
      supabaseUrl: config.supabaseUrl,
      supabaseAnonKey: config.supabaseAnonKey,
      openaiApiKey: config.openaiApiKey,
      contributorId: config.contributorId,
      similarityThreshold: config.similarityThreshold,
    });
  }

  // Plugin context (shared state)
  const pluginContext: FixHiveContext = {
    sessionId: '',
    projectDirectory: ctx.directory,
    language: detectLanguage(ctx.directory),
    framework: detectFramework(ctx.directory),
  };

  // Error-producing tools to monitor
  const errorProducingTools = ['bash', 'edit', 'write', 'read', 'terminal'];

  return {
    // ============ Tool Execution Hook ============
    'tool.execute.after': async (input, output) => {
      // Only process tools that can produce errors
      if (!errorProducingTools.includes(input.tool)) return;

      // Detect errors in output
      const detection = errorDetector.detect({
        tool: input.tool,
        output: output.output,
        exitCode: (output.metadata as Record<string, number>)?.exitCode,
        stderr: (output.metadata as Record<string, string>)?.stderr,
        metadata: output.metadata as Record<string, unknown>,
      });

      if (detection.detected && detection.confidence >= 0.5) {
        // Store error locally
        const errorRecord = localStore.createErrorRecord({
          errorType: detection.errorType,
          errorMessage: detection.errorMessage,
          errorStack: detection.errorStack,
          language: pluginContext.language,
          framework: pluginContext.framework,
          toolName: input.tool,
          toolInput: {},
          sessionId: pluginContext.sessionId || input.sessionID,
        });

        // Query cloud for solutions if client available
        if (cloudClient) {
          try {
            const solutions = await cloudClient.searchSimilar({
              errorMessage: detection.errorMessage,
              errorStack: detection.errorStack,
              language: pluginContext.language,
              framework: pluginContext.framework,
              limit: 3,
            });

            if (solutions.results.length > 0) {
              // Cache results
              localStore.cacheResults(
                generateErrorFingerprint(detection.errorMessage, detection.errorStack),
                solutions.results
              );

              // Append solution hints to output title
              output.title = `${output.title} [FixHive: ${solutions.results.length} solution(s) found]`;
            }
          } catch (e) {
            // Silently fail cloud queries
            console.error('[FixHive] Cloud query failed:', e);
          }
        }
      }
    },

    // ============ Session Compaction Hook ============
    'experimental.session.compacting': async (input, output) => {
      const unresolvedErrors = localStore.getUnresolvedErrors(pluginContext.sessionId);

      if (unresolvedErrors.length > 0) {
        output.context.push(`
## FixHive: Unresolved Errors in Session

${unresolvedErrors.map((e) => `- [${e.id.slice(0, 8)}] ${e.errorType}: ${e.errorMessage.slice(0, 100)}...`).join('\n')}

Use \`fixhive_mark_resolved\` when errors are fixed to contribute solutions.
`);
      }
    },

    // ============ Chat Message Hook ============
    'chat.message': async (input, _output) => {
      // Update session ID
      pluginContext.sessionId = input.sessionID;
    },

    // ============ Custom Tools ============
    tool: cloudClient
      ? createTools(localStore, cloudClient, privacyFilter, pluginContext)
      : createOfflineTools(localStore, privacyFilter, pluginContext),
  };
};

/**
 * Create offline-only tools when cloud is not configured
 */
function createOfflineTools(
  localStore: LocalStore,
  privacyFilter: PrivacyFilter,
  context: FixHiveContext
) {
  const { tool } = require('@opencode-ai/plugin');

  return {
    fixhive_list: tool({
      description: 'List errors detected in the current session.',
      args: {
        status: tool.schema
          .enum(['unresolved', 'resolved', 'uploaded'])
          .optional()
          .describe('Filter by status'),
        limit: tool.schema.number().optional().describe('Maximum results (default: 10)'),
      },
      async execute(args: { status?: string; limit?: number }, ctx: { sessionID: string }) {
        context.sessionId = ctx.sessionID;

        const errors = localStore.getSessionErrors(ctx.sessionID, {
          status: args.status as 'unresolved' | 'resolved' | 'uploaded',
          limit: args.limit || 10,
        });

        if (errors.length === 0) {
          return 'No errors recorded in this session.';
        }

        return `## Session Errors (${errors.length})\n\n${errors.map((e) => `- [${e.id.slice(0, 8)}] ${e.errorType}: ${e.errorMessage.slice(0, 80)}...`).join('\n')}\n\n*Cloud features disabled. Set FIXHIVE_SUPABASE_URL and FIXHIVE_SUPABASE_KEY to enable.*`;
      },
    }),

    fixhive_stats: tool({
      description: 'Get FixHive usage statistics.',
      args: {},
      async execute() {
        const stats = localStore.getStats();

        return `
## FixHive Statistics (Offline Mode)

### Local
- Errors recorded: ${stats.totalErrors}
- Resolved: ${stats.resolvedErrors}
- Uploaded: ${stats.uploadedErrors}

*Cloud features disabled. Set FIXHIVE_SUPABASE_URL and FIXHIVE_SUPABASE_KEY to enable community sharing.*
`;
      },
    }),
  };
}

/**
 * Load configuration from environment
 */
function loadConfig(): FixHiveConfig {
  return {
    supabaseUrl: process.env.FIXHIVE_SUPABASE_URL || '',
    supabaseAnonKey: process.env.FIXHIVE_SUPABASE_KEY || '',
    openaiApiKey: process.env.OPENAI_API_KEY || process.env.FIXHIVE_OPENAI_KEY || '',
    contributorId: process.env.FIXHIVE_CONTRIBUTOR_ID || '',
    cacheExpirationMs: DEFAULT_CONFIG.cacheExpirationMs!,
    embeddingModel: DEFAULT_CONFIG.embeddingModel!,
    embeddingDimensions: DEFAULT_CONFIG.embeddingDimensions!,
    similarityThreshold: DEFAULT_CONFIG.similarityThreshold!,
    maxSearchResults: DEFAULT_CONFIG.maxSearchResults!,
  };
}

/**
 * Detect programming language from project
 */
function detectLanguage(directory: string): Language | undefined {
  const fs = require('fs');
  const path = require('path');

  const indicators: [string, Language][] = [
    ['package.json', 'typescript'],
    ['tsconfig.json', 'typescript'],
    ['pyproject.toml', 'python'],
    ['requirements.txt', 'python'],
    ['Cargo.toml', 'rust'],
    ['go.mod', 'go'],
    ['pom.xml', 'java'],
    ['build.gradle', 'java'],
    ['Gemfile', 'ruby'],
    ['composer.json', 'php'],
  ];

  for (const [file, lang] of indicators) {
    if (fs.existsSync(path.join(directory, file))) {
      return lang;
    }
  }

  return undefined;
}

/**
 * Detect framework from project
 */
function detectFramework(directory: string): string | undefined {
  const fs = require('fs');
  const path = require('path');

  // Check package.json for JS/TS projects
  const pkgPath = path.join(directory, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      if (deps['next']) return 'nextjs';
      if (deps['react']) return 'react';
      if (deps['vue']) return 'vue';
      if (deps['@angular/core']) return 'angular';
      if (deps['express']) return 'express';
      if (deps['fastify']) return 'fastify';
      if (deps['hono']) return 'hono';
    } catch {
      // Ignore parse errors
    }
  }

  // Check for Python frameworks
  const reqPath = path.join(directory, 'requirements.txt');
  if (fs.existsSync(reqPath)) {
    try {
      const content = fs.readFileSync(reqPath, 'utf-8');
      if (content.includes('django')) return 'django';
      if (content.includes('flask')) return 'flask';
      if (content.includes('fastapi')) return 'fastapi';
    } catch {
      // Ignore read errors
    }
  }

  return undefined;
}

export default FixHivePlugin;
