/**
 * FixHive Privacy Filter
 * Sanitizes sensitive information from error messages before sharing
 */

import type { PrivacyFilterRule, SanitizedContent, FilterContext } from '../types/index.js';

/**
 * Default privacy filtering rules sorted by priority (highest first)
 */
const DEFAULT_FILTER_RULES: PrivacyFilterRule[] = [
  // =====================================
  // SECRETS (Critical - Always Filter)
  // =====================================

  // AWS Keys
  {
    name: 'aws_access_key',
    category: 'secret',
    pattern: /\b(A3T[A-Z0-9]|AKIA|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}\b/g,
    replacement: '[AWS_KEY_REDACTED]',
    priority: 100,
  },

  // OpenAI API Keys
  {
    name: 'openai_key',
    category: 'secret',
    pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/g,
    replacement: '[OPENAI_KEY_REDACTED]',
    priority: 100,
  },

  // GitHub Tokens
  {
    name: 'github_token',
    category: 'secret',
    pattern: /\b(gh[pousr]_[A-Za-z0-9_]{36,}|github_pat_[A-Za-z0-9_]{22,})\b/g,
    replacement: '[GITHUB_TOKEN_REDACTED]',
    priority: 100,
  },

  // Google API Keys
  {
    name: 'google_api_key',
    category: 'secret',
    pattern: /\bAIza[0-9A-Za-z\-_]{35}\b/g,
    replacement: '[GOOGLE_API_KEY_REDACTED]',
    priority: 100,
  },

  // Stripe Keys
  {
    name: 'stripe_key',
    category: 'secret',
    pattern: /\b(sk|pk|rk)_(live|test)_[0-9a-zA-Z]{24,}\b/g,
    replacement: '[STRIPE_KEY_REDACTED]',
    priority: 100,
  },

  // JWT Tokens
  {
    name: 'jwt_token',
    category: 'secret',
    pattern: /\beyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    replacement: '[JWT_REDACTED]',
    priority: 100,
  },

  // Bearer Tokens
  {
    name: 'bearer_token',
    category: 'secret',
    pattern: /\b(Bearer|Authorization:?\s*Bearer)\s+[\w\-._~+\/]+=*/gi,
    replacement: '$1 [TOKEN_REDACTED]',
    priority: 100,
  },

  // Private Keys
  {
    name: 'private_key',
    category: 'secret',
    pattern:
      /-----BEGIN\s+(RSA|DSA|EC|OPENSSH|PGP)?\s*PRIVATE KEY-----[\s\S]*?-----END\s+(RSA|DSA|EC|OPENSSH|PGP)?\s*PRIVATE KEY-----/g,
    replacement: '[PRIVATE_KEY_REDACTED]',
    priority: 100,
  },

  // Generic API Keys (context-based)
  {
    name: 'generic_api_key',
    category: 'secret',
    pattern: /\b(api[_-]?key|apikey|api[_-]?secret)\s*[=:]\s*["']?[\w\-]{20,}["']?/gi,
    replacement: '$1=[KEY_REDACTED]',
    priority: 95,
  },

  // Secret/Password assignments
  {
    name: 'secret_assignment',
    category: 'secret',
    pattern: /\b(password|passwd|pwd|secret|token|credential)\s*[=:]\s*["']?[^\s"']{8,}["']?/gi,
    replacement: '$1=[REDACTED]',
    priority: 90,
  },

  // =====================================
  // IDENTITY (High Risk)
  // =====================================

  // Email Addresses
  {
    name: 'email',
    category: 'identity',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    replacement: '[EMAIL_REDACTED]',
    priority: 80,
  },

  // =====================================
  // INFRASTRUCTURE (Medium Risk)
  // =====================================

  // Database Connection Strings
  {
    name: 'db_connection',
    category: 'infrastructure',
    pattern: /\b(mongodb|postgres|postgresql|mysql|redis|amqp):\/\/[^\s]+/gi,
    replacement: '$1://[CONNECTION_REDACTED]',
    priority: 85,
  },

  // Internal URLs
  {
    name: 'internal_url',
    category: 'infrastructure',
    pattern:
      /\bhttps?:\/\/(?:[\w-]+\.)*(?:internal|corp|local|intranet|private)[\w.-]*(?::\d+)?(?:\/[^\s]*)?/gi,
    replacement: '[INTERNAL_URL_REDACTED]',
    priority: 75,
  },

  // IP Addresses (except localhost and common dev IPs)
  {
    name: 'ipv4',
    category: 'infrastructure',
    pattern: /\b(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/g,
    replacement: (match: string) => {
      // Keep localhost and common dev IPs
      if (match === '127.0.0.1' || match === '0.0.0.0' || match.startsWith('192.168.')) {
        return match;
      }
      return '[IP_REDACTED]';
    },
    priority: 70,
  },

  // =====================================
  // FILE PATHS (Context-dependent)
  // =====================================

  // Home Directory Paths (macOS)
  {
    name: 'macos_home_path',
    category: 'path',
    pattern: /\/Users\/[\w.-]+/g,
    replacement: '~',
    priority: 60,
  },

  // Home Directory Paths (Linux)
  {
    name: 'linux_home_path',
    category: 'path',
    pattern: /\/home\/[\w.-]+/g,
    replacement: '~',
    priority: 60,
  },

  // Home Directory Paths (Windows)
  {
    name: 'windows_home_path',
    category: 'path',
    pattern: /C:\\Users\\[\w.-]+/gi,
    replacement: '~',
    priority: 60,
  },

  // =====================================
  // ENVIRONMENT (Medium Risk)
  // =====================================

  // Sensitive Environment Variables
  {
    name: 'env_var_value',
    category: 'environment',
    pattern: /\b([A-Z_][A-Z0-9_]*)\s*=\s*["']?([^\s"']+)["']?/g,
    replacement: (match: string, name: string, _value: string) => {
      const sensitivePatterns = [
        'API_KEY',
        'SECRET',
        'PASSWORD',
        'TOKEN',
        'CREDENTIAL',
        'PRIVATE',
        'AUTH',
        'DATABASE_URL',
        'REDIS_URL',
        'OPENAI',
        'STRIPE',
        'AWS',
      ];
      if (sensitivePatterns.some((s) => name.toUpperCase().includes(s))) {
        return `${name}=[REDACTED]`;
      }
      return match;
    },
    priority: 65,
  },
];

/**
 * Privacy Filter Pipeline
 * Applies multiple filtering rules to sanitize sensitive content
 */
export class PrivacyFilter {
  private rules: PrivacyFilterRule[];

  constructor(customRules?: PrivacyFilterRule[]) {
    // Combine default and custom rules, sort by priority
    this.rules = [...DEFAULT_FILTER_RULES, ...(customRules || [])].sort(
      (a, b) => b.priority - a.priority
    );
  }

  /**
   * Sanitize content by applying all filter rules
   */
  sanitize(content: string, context?: FilterContext): SanitizedContent {
    let result = content;
    const appliedFilters: string[] = [];
    let totalRedacted = 0;

    // Apply each filter rule in priority order
    for (const rule of this.rules) {
      const before = result;

      if (typeof rule.replacement === 'function') {
        result = result.replace(rule.pattern, rule.replacement as (...args: string[]) => string);
      } else {
        result = result.replace(rule.pattern, rule.replacement);
      }

      if (result !== before) {
        const matches = before.match(rule.pattern);
        if (matches) {
          totalRedacted += matches.length;
          appliedFilters.push(rule.name);
        }
      }
    }

    // Apply path generalization if context provided
    if (context) {
      result = this.generalizePaths(result, context);
    }

    return {
      original: content,
      sanitized: result,
      redactedCount: totalRedacted,
      appliedFilters: [...new Set(appliedFilters)],
    };
  }

  /**
   * Generalize file paths while keeping meaningful structure
   */
  private generalizePaths(content: string, context: FilterContext): string {
    let result = content;

    // Replace project root with <PROJECT>
    if (context.projectRoot) {
      const escapedRoot = context.projectRoot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedRoot, 'g'), '<PROJECT>');
    }

    // Replace common paths
    for (const [fullPath, alias] of context.commonPaths) {
      const escapedPath = fullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedPath, 'g'), alias);
    }

    // Normalize node_modules paths
    result = result.replace(/node_modules\/(?:@[\w.-]+\/)?[\w.-]+\//g, 'node_modules/<PKG>/');

    // Normalize site-packages paths
    result = result.replace(/site-packages\/[\w.-]+\//g, 'site-packages/<PKG>/');

    return result;
  }

  /**
   * Add a custom filter rule
   */
  addRule(rule: PrivacyFilterRule): void {
    this.rules.push(rule);
    this.rules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Remove a filter rule by name
   */
  removeRule(name: string): boolean {
    const index = this.rules.findIndex((r) => r.name === name);
    if (index !== -1) {
      this.rules.splice(index, 1);
      return true;
    }
    return false;
  }

  /**
   * Get all current rules
   */
  getRules(): ReadonlyArray<PrivacyFilterRule> {
    return this.rules;
  }

  /**
   * Check if content contains sensitive data
   */
  containsSensitiveData(content: string): boolean {
    for (const rule of this.rules) {
      if (rule.category === 'secret' && rule.pattern.test(content)) {
        // Reset regex state
        rule.pattern.lastIndex = 0;
        return true;
      }
      // Reset regex state for global patterns
      rule.pattern.lastIndex = 0;
    }
    return false;
  }
}

/**
 * Create default filter context from project directory
 */
export function createFilterContext(projectDirectory: string): FilterContext {
  const homeDir = process.env.HOME || process.env.USERPROFILE || '~';

  return {
    projectRoot: projectDirectory,
    homeDir,
    commonPaths: new Map([
      ['/usr/local/lib/', '<LIB>/'],
      ['/usr/lib/', '<LIB>/'],
      ['/var/log/', '<LOG>/'],
      ['/tmp/', '<TMP>/'],
      ['/etc/', '<ETC>/'],
    ]),
  };
}

// Export default instance
export const defaultPrivacyFilter = new PrivacyFilter();
