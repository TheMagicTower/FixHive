/**
 * FixHive OpenCode Plugin - CodeCaseDB v2.0
 *
 * Community-based error knowledge sharing plugin for OpenCode
 */

import type { Plugin } from '@opencode-ai/plugin';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  createCloudClient,
  getDeviceId,
} from '@the-magic-tower/fixhive-shared';
import type { CloudClient } from '@the-magic-tower/fixhive-shared';
import { createTools, createOfflineTools } from './tools.js';

type Language =
  | 'typescript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'ruby'
  | 'php'
  | 'unknown';

interface FixHiveConfig {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
  deviceId: string;
}

interface FixHiveContext {
  sessionId: string;
  projectDirectory: string;
  language?: string;
  framework?: string;
  packages?: Record<string, string>;
}

/**
 * Default FixHive Community Supabase
 */
const COMMUNITY_SUPABASE = {
  url: 'https://flpqzkrpufrgnpxvftip.supabase.co',
  anonKey: 'sb_publishable_w3Y2uo-0vb4bFVamntChVw_Aqi0rv2y',
};

/**
 * FixHive Plugin Factory
 */
export const FixHivePlugin: Plugin = async (ctx) => {
  console.log('[FixHive] Starting plugin initialization (CodeCaseDB v2.0)');

  // Load configuration from environment
  const config = loadConfig();

  console.log('[FixHive] Plugin loaded');
  console.log(`[FixHive] Project: ${ctx.directory}`);
  console.log(`[FixHive] Cloud: ${config.supabaseUrl ? 'enabled' : 'disabled'}`);
  console.log(`[FixHive] Device: ${config.deviceId.slice(0, 8)}...`);

  // Initialize cloud client if configured
  let cloudClient: CloudClient | null = null;
  if (config.supabaseUrl && config.supabaseAnonKey) {
    try {
      cloudClient = createCloudClient({
        supabaseUrl: config.supabaseUrl,
        supabaseKey: config.supabaseAnonKey,
        deviceId: config.deviceId,
      });
      console.log('[FixHive] Cloud client initialized');
    } catch (err) {
      console.error('[FixHive] Failed to initialize cloud client:', err);
      console.error('[FixHive] Falling back to offline mode');
    }
  }

  // Plugin context (shared state)
  const pluginContext: FixHiveContext = {
    sessionId: '',
    projectDirectory: ctx.directory,
    language: detectLanguage(ctx.directory),
    framework: detectFramework(ctx.directory),
    packages: detectPackages(ctx.directory),
  };

  // Log detected environment
  if (pluginContext.language) {
    console.log(
      `[FixHive] Detected: ${pluginContext.language}${pluginContext.framework ? ` / ${pluginContext.framework}` : ''}`
    );
  }
  console.log('[FixHive] Ready - use fixhive_search_cases to find solutions');

  // Error-producing tools to monitor
  const errorProducingTools = ['bash', 'edit', 'write', 'read', 'terminal'];

  return {
    // ============ Tool Execution Hook ============
    'tool.execute.after': async (input, output) => {
      // Only process tools that can produce errors
      if (!errorProducingTools.includes(input.tool)) return;

      // Simple error detection (confidence-based)
      const hasError = detectErrorInOutput(output.output);

      if (hasError) {
        console.log(`[FixHive] Potential error detected in ${input.tool} output`);
        console.log(
          '[FixHive] Use fixhive_search_cases with a normalized error signature to find solutions'
        );

        // Append hint to output
        output.title = `${output.title} [FixHive: Error detected - use fixhive_search_cases]`;
      }
    },

    // ============ Chat Message Hook ============
    'chat.message': async (input, _output) => {
      pluginContext.sessionId = input.sessionID;
    },

    // ============ Custom Tools ============
    tool: cloudClient
      ? createTools(cloudClient, pluginContext)
      : createOfflineTools(pluginContext),
  };
};

/**
 * Load configuration from environment (with community defaults)
 */
function loadConfig(): FixHiveConfig {
  return {
    supabaseUrl: process.env.FIXHIVE_SUPABASE_URL || COMMUNITY_SUPABASE.url,
    supabaseAnonKey: process.env.FIXHIVE_SUPABASE_KEY || COMMUNITY_SUPABASE.anonKey,
    deviceId: getDeviceId(),
  };
}

/**
 * Detect errors in tool output
 */
function detectErrorInOutput(output: string): boolean {
  const errorPatterns = [
    /error:/i,
    /exception:/i,
    /traceback/i,
    /failed:/i,
    /fatal:/i,
    /cannot find/i,
    /undefined is not/i,
    /is not defined/i,
    /syntaxerror/i,
    /typeerror/i,
    /referenceerror/i,
    /SQLSTATE/,
    /errno/i,
  ];

  return errorPatterns.some((pattern) => pattern.test(output));
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
      if (deps['laravel']) return 'laravel';
    } catch {
      // Ignore parse errors
    }
  }

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

/**
 * Detect package versions from project
 */
function detectPackages(directory: string): Record<string, string> | undefined {
  const pkgPath = join(directory, 'package.json');
  if (existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      // Return top 5 important packages
      const important = [
        'react',
        'next',
        'vue',
        'angular',
        'express',
        'typescript',
        'node',
      ];
      const result: Record<string, string> = {};

      for (const pkg of important) {
        if (deps[pkg]) {
          result[pkg] = deps[pkg].replace(/^[\^~]/, '');
        }
      }

      return Object.keys(result).length > 0 ? result : undefined;
    } catch {
      // Ignore parse errors
    }
  }

  return undefined;
}

export default FixHivePlugin;
