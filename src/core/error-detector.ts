/**
 * FixHive Error Detector
 * Detects errors from tool outputs using multi-signal analysis
 */

import type {
  ErrorType,
  Severity,
  DetectedSignal,
  ErrorDetectionResult,
  StackTraceInfo,
  ToolOutput,
} from '../types/index.js';
import { createPrivacyFilter, type PrivacyFilter } from './privacy-filter.js';

/**
 * Error keyword patterns by category
 */
const ERROR_PATTERNS: Record<string, RegExp[]> = {
  // Universal error indicators
  universal: [
    /\b(error|failed|failure|fatal|exception|panic)\b/i,
    /\b(cannot|could not|unable to|couldn't)\b/i,
    /\b(denied|rejected|refused|forbidden)\b/i,
    /\b(not found|missing|undefined|null pointer)\b/i,
    /\b(invalid|illegal|malformed|corrupt)\b/i,
    /\b(timeout|timed out|connection refused)\b/i,
    /\b(segmentation fault|segfault|core dumped)\b/i,
    /\b(out of memory|oom|memory allocation failed)\b/i,
  ],

  // Error prefixes
  prefixed: [
    /^Error:/m,
    /^ERROR\s/m,
    /^E\s+\d+:/m, // Rust errors
    /^\[ERROR\]/m,
    /^fatal:/m,
    /^FATAL:/m,
    /^panic:/m,
    /^Traceback \(most recent call last\):/m, // Python
    /^Exception in thread/m, // Java
    /^Uncaught \w+Error:/m, // JavaScript
  ],

  // Build/compilation errors
  build: [
    /^.+:\d+:\d+:\s*error:/m, // GCC/Clang format
    /error\[E\d+\]:/m, // Rust compiler
    /error TS\d+:/m, // TypeScript
    /SyntaxError:/m,
    /ParseError:/m,
    /CompileError:/m,
  ],

  // Package manager errors
  package: [
    /npm ERR!/m,
    /npm error/m,
    /yarn error/m,
    /pnpm error/m,
    /pip error/m,
    /cargo error/m,
    /ModuleNotFoundError:/m,
    /ImportError:/m,
    /Cannot find module/m,
    /Module not found/m,
  ],

  // Permission errors
  permission: [/EACCES:/m, /EPERM:/m, /Permission denied/m, /Access denied/m, /Insufficient permissions/m],

  // Network errors
  network: [
    /ECONNREFUSED/m,
    /ETIMEDOUT/m,
    /ENOTFOUND/m,
    /getaddrinfo ENOTFOUND/m,
    /Connection refused/m,
    /Network is unreachable/m,
  ],

  // Test failures
  test: [/FAIL /m, /AssertionError/m, /Expected .+ but got/m, /Test failed/i, /\d+ failing/m],
};

/**
 * Stack trace patterns by language
 */
const STACK_TRACE_PATTERNS: Record<string, RegExp> = {
  javascript: /^\s+at\s+(?:(?:async\s+)?[\w.<>]+\s+\()?(?:[\w/\\.:-]+:\d+:\d+|native|<anonymous>)\)?$/m,
  python: /^\s+File\s+"[^"]+",\s+line\s+\d+/m,
  java: /^\s+at\s+[\w.$]+\([\w.]+:\d+\)$/m,
  golang: /^goroutine\s+\d+\s+\[.+\]:/m,
  rust: /^\s+\d+:\s+0x[\da-f]+\s+-\s+.+$/m,
  ruby: /^\s+from\s+[\w/\\.]+:\d+:in\s+`.+'$/m,
  php: /^#\d+\s+[\w/\\.]+\(\d+\):\s+[\w\\]+/m,
  csharp: /^\s+at\s+[\w.<>]+\s+in\s+[\w/\\.]+:line\s+\d+$/m,
};

/**
 * Exit code severity mapping
 */
const EXIT_CODE_SEVERITY: Record<number, Severity> = {
  1: 'error', // General errors
  2: 'error', // Misuse of shell builtins
  126: 'error', // Command cannot execute
  127: 'error', // Command not found
  128: 'critical', // Invalid exit argument
  130: 'warning', // Script terminated by Ctrl+C
  137: 'critical', // SIGKILL (OOM, etc.)
  139: 'critical', // Segmentation fault
  143: 'warning', // SIGTERM
};

/**
 * ErrorDetector interface - defines all public methods
 */
export interface ErrorDetector {
  detect(toolOutput: ToolOutput): ErrorDetectionResult;
}

/**
 * Create an ErrorDetector instance
 * Factory function pattern to avoid ES6 class issues with Bun
 */
export function createErrorDetector(privacyFilter?: PrivacyFilter): ErrorDetector {
  const filter = privacyFilter || createPrivacyFilter();

  /**
   * Check if content contains error keywords
   */
  function containsErrorKeywords(content: string): boolean {
    return ERROR_PATTERNS.universal.some((p) => p.test(content));
  }

  /**
   * Detect error patterns in content
   */
  function detectErrorPatterns(content: string): DetectedSignal[] {
    const signals: DetectedSignal[] = [];
    const weights: Record<string, number> = {
      prefixed: 0.85,
      build: 0.8,
      package: 0.75,
      permission: 0.8,
      network: 0.75,
      test: 0.7,
    };

    for (const [category, patterns] of Object.entries(ERROR_PATTERNS)) {
      if (category === 'universal') continue; // Already used for keyword check

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          signals.push({
            type: 'pattern',
            weight: weights[category] || 0.7,
            value: match[0].substring(0, 200),
            description: `Matched ${category} pattern: ${pattern.source.substring(0, 50)}`,
          });
          break; // One match per category is enough
        }
      }
    }

    return signals;
  }

  /**
   * Detect stack traces in content
   */
  function detectStackTrace(content: string): StackTraceInfo {
    for (const [language, pattern] of Object.entries(STACK_TRACE_PATTERNS)) {
      const globalPattern = new RegExp(pattern.source, 'gm');
      const matches = content.match(globalPattern);
      if (matches && matches.length >= 2) {
        return {
          hasStackTrace: true,
          language,
          frames: matches,
        };
      }
    }

    return {
      hasStackTrace: false,
      language: null,
      frames: [],
    };
  }

  /**
   * Calculate confidence score from signals
   */
  function calculateConfidence(signals: DetectedSignal[]): number {
    if (signals.length === 0) return 0;

    // Weighted average with diminishing returns for multiple signals
    const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
    const avgWeight = totalWeight / signals.length;

    // Boost confidence for multiple signals
    const multiplier = Math.min(1.2, 1 + signals.length * 0.05);

    return Math.min(1.0, avgWeight * multiplier);
  }

  /**
   * Classify error type based on signals and content
   */
  function classifyErrorType(signals: DetectedSignal[], content: string): ErrorType {
    // Check for specific patterns
    if (ERROR_PATTERNS.build.some((p) => p.test(content))) return 'build';
    if (ERROR_PATTERNS.package.some((p) => p.test(content))) return 'dependency';
    if (ERROR_PATTERNS.permission.some((p) => p.test(content))) return 'permission';
    if (ERROR_PATTERNS.network.some((p) => p.test(content))) return 'network';
    if (ERROR_PATTERNS.test.some((p) => p.test(content))) return 'test';

    // Check for type errors
    if (/TypeError:|type error|Type '[^']+' is not assignable/i.test(content)) return 'type_error';

    // Check for syntax errors
    if (/SyntaxError:|syntax error|unexpected token/i.test(content)) return 'syntax';

    // Check for runtime errors
    if (/ReferenceError:|RangeError:|runtime error/i.test(content)) return 'runtime';

    // Check signals
    const hasStackTrace = signals.some((s) => s.type === 'stack_trace');
    if (hasStackTrace) return 'runtime';

    return 'unknown';
  }

  /**
   * Determine severity from signals and exit code
   */
  function determineSeverity(signals: DetectedSignal[], exitCode?: number): Severity {
    // Check exit code first
    if (exitCode !== undefined && EXIT_CODE_SEVERITY[exitCode]) {
      return EXIT_CODE_SEVERITY[exitCode];
    }

    // High confidence signals indicate error
    const maxWeight = Math.max(...signals.map((s) => s.weight));
    if (maxWeight >= 0.9) return 'error';
    if (maxWeight >= 0.7) return 'error';

    return 'warning';
  }

  /**
   * Check if a line looks like an error message
   */
  function isErrorLine(line: string): boolean {
    const trimmed = line.trim();
    return (
      /^(Error|TypeError|ReferenceError|SyntaxError|RangeError):/i.test(trimmed) ||
      /^(error|FAIL|fatal|panic)\b/i.test(trimmed) ||
      /^error\[E\d+\]:/.test(trimmed) ||
      /^error TS\d+:/.test(trimmed)
    );
  }

  /**
   * Extract error message and stack from output
   */
  function extractErrorDetails(output: string): { message: string; stack?: string } {
    const lines = output.split('\n');
    let message = '';
    let stack = '';
    let inStack = false;

    for (const line of lines) {
      if (isErrorLine(line) && !message) {
        message = line.trim();
        inStack = true;
      } else if (
        inStack &&
        (line.match(/^\s+at\s/) || // JS stack
          line.match(/^\s+File\s/) || // Python stack
          line.match(/^\s+\d+:\s/) || // Rust stack
          line.match(/^\s+from\s/)) // Ruby stack
      ) {
        stack += line + '\n';
      }
    }

    // If no specific error line found, use first non-empty line
    if (!message) {
      for (const line of lines) {
        if (line.trim()) {
          message = line.trim();
          break;
        }
      }
    }

    return {
      message: message || output.substring(0, 500),
      stack: stack || undefined,
    };
  }

  return {
    /**
     * Detect if output contains an error
     */
    detect(toolOutput: ToolOutput): ErrorDetectionResult {
      const signals: DetectedSignal[] = [];
      const combinedOutput = `${toolOutput.output || ''}\n${toolOutput.stderr || ''}`;

      // Signal 1: Exit code
      if (toolOutput.exitCode !== undefined && toolOutput.exitCode !== 0) {
        const severity = EXIT_CODE_SEVERITY[toolOutput.exitCode] || 'error';
        signals.push({
          type: 'exit_code',
          weight: 0.9,
          value: toolOutput.exitCode,
          description: `Non-zero exit code: ${toolOutput.exitCode} (${severity})`,
        });
      }

      // Signal 2: Stderr presence
      if (toolOutput.stderr && toolOutput.stderr.trim().length > 0) {
        const hasErrorKeywords = containsErrorKeywords(toolOutput.stderr);
        const stderrWeight = hasErrorKeywords ? 0.85 : 0.4;
        signals.push({
          type: 'stderr',
          weight: stderrWeight,
          value: toolOutput.stderr.substring(0, 500),
          description: hasErrorKeywords ? 'Stderr with error keywords' : 'Stderr output present',
        });
      }

      // Signal 3: Error patterns
      const patternMatches = detectErrorPatterns(combinedOutput);
      signals.push(...patternMatches);

      // Signal 4: Stack trace
      const stackTrace = detectStackTrace(combinedOutput);
      if (stackTrace.hasStackTrace) {
        signals.push({
          type: 'stack_trace',
          weight: 0.95,
          value: stackTrace.frames.slice(0, 5).join('\n'),
          description: `${stackTrace.language} stack trace detected`,
        });
      }

      // Calculate confidence
      const confidence = calculateConfidence(signals);
      const detected = confidence >= 0.5;

      // Determine error type and severity
      const errorType = classifyErrorType(signals, combinedOutput);
      const severity = determineSeverity(signals, toolOutput.exitCode);

      // Extract error details
      const { message, stack } = extractErrorDetails(combinedOutput);

      // Sanitize output
      const sanitizedMessage = filter.sanitize(message);
      const sanitizedStack = stack ? filter.sanitize(stack) : undefined;
      const sanitizedOutput = filter.sanitize(combinedOutput.substring(0, 5000));

      return {
        detected,
        confidence,
        errorType,
        severity,
        signals,
        errorMessage: sanitizedMessage.sanitized,
        errorStack: sanitizedStack?.sanitized,
        rawOutput: sanitizedOutput.sanitized,
      };
    },
  };
}

/**
 * Legacy class wrapper for backwards compatibility
 * @deprecated Use createErrorDetector() instead
 */
export const ErrorDetector = {
  create: createErrorDetector,
};

// Export default instance factory
export const defaultErrorDetector = createErrorDetector();
