/**
 * FixHive OpenCode Plugin
 * Community-based error knowledge sharing plugin for OpenCode
 */

import type { Plugin } from '@opencode-ai/plugin';
import { tool } from '@opencode-ai/plugin';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  // Log plugin initialization
  console.log('[FixHive] Plugin loaded');
  console.log(`[FixHive] Project: ${ctx.directory}`);
  console.log(`[FixHive] Cloud: ${config.supabaseUrl ? 'enabled' : 'disabled'}`);

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

  // Log detected environment
  if (pluginContext.language) {
    console.log(`[FixHive] Detected: ${pluginContext.language}${pluginContext.framework ? ` / ${pluginContext.framework}` : ''}`);
  }
  console.log('[FixHive] Ready - use fixhive_stats to verify');

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
        // Sanitize error data before storing locally
        const sanitizedErrorMessage = privacyFilter.sanitize(detection.errorMessage, filterContext).sanitized;
        const sanitizedErrorStack = detection.errorStack
          ? privacyFilter.sanitize(detection.errorStack, filterContext).sanitized
          : undefined;

        // Store error locally (with sanitized data)
        localStore.createErrorRecord({
          errorType: detection.errorType,
          errorMessage: sanitizedErrorMessage,
          errorStack: sanitizedErrorStack,
          language: pluginContext.language,
          framework: pluginContext.framework,
          toolName: input.tool,
          toolInput: {}, // Tool input is intentionally omitted to avoid storing sensitive data
          sessionId: pluginContext.sessionId || input.sessionID,
        });

        // Query cloud for solutions if client available
        if (cloudClient) {
          try {
            // Use already-sanitized error data for cloud query
            const solutions = await cloudClient.searchSimilar({
              errorMessage: sanitizedErrorMessage,
              errorStack: sanitizedErrorStack,
              language: pluginContext.language,
              framework: pluginContext.framework,
              limit: 3,
            });

            if (solutions.results.length > 0) {
              // Cache results using sanitized fingerprint
              localStore.cacheResults(
                generateErrorFingerprint(sanitizedErrorMessage, sanitizedErrorStack),
                solutions.results
              );

              // Append solution hints to output title
              output.title = `${output.title} [FixHive: ${solutions.results.length} solution(s) found]`;
            }
          } catch (e) {
            // Log error with context but avoid exposing sensitive details
            const errorMessage = e instanceof Error ? e.message : 'Unknown error';
            console.error(`[FixHive] Cloud query failed: ${errorMessage}`);
            // Don't throw - gracefully degrade to offline mode
          }
        }
      }
    },

    // ============ Session Compaction Hook ============
    'experimental.session.compacting': async (_input, output) => {
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
  _privacyFilter: PrivacyFilter,
  context: FixHiveContext
) {
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
 * Default FixHive Community Supabase (공유 지식 베이스)
 * 환경변수로 오버라이드 가능
 */
const COMMUNITY_SUPABASE = {
  url: 'https://flpqzkrpufrgnpxvftip.supabase.co',
  anonKey: 'sb_publishable_w3Y2uo-0vb4bFVamntChVw_Aqi0rv2y',
};

/**
 * Load configuration from environment (with community defaults)
 */
function loadConfig(): FixHiveConfig {
  return {
    supabaseUrl: process.env.FIXHIVE_SUPABASE_URL || COMMUNITY_SUPABASE.url,
    supabaseAnonKey: process.env.FIXHIVE_SUPABASE_KEY || COMMUNITY_SUPABASE.anonKey,
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
    if (existsSync(join(directory, file))) {
      return lang;
    }
  }

  return undefined;
}

/**
 * Detect framework from project
 */
function detectFramework(directory: string): string | undefined {
  // Check package.json for JS/TS projects
  const pkgPath = join(directory, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
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
  const reqPath = join(directory, 'requirements.txt');
  if (existsSync(reqPath)) {
    try {
      const content = readFileSync(reqPath, 'utf-8');
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
