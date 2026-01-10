import { describe, it, expect, beforeEach } from 'vitest';
import { createErrorDetector, defaultErrorDetector, type ErrorDetector } from '../../src/core/error-detector.js';

describe('ErrorDetector', () => {
  let detector: ErrorDetector;

  beforeEach(() => {
    detector = createErrorDetector();
  });

  describe('Exit Code Detection', () => {
    it('should detect error from non-zero exit code', () => {
      const result = detector.detect({
        toolName: 'bash',
        exitCode: 1,
        output: 'Some output',
      });
      expect(result.detected).toBe(true);
      expect(result.signals.some((s) => s.type === 'exit_code')).toBe(true);
    });

    it('should not detect error from zero exit code', () => {
      const result = detector.detect({
        toolName: 'bash',
        exitCode: 0,
        output: 'Success',
      });
      expect(result.detected).toBe(false);
    });

    it('should mark exit code 137 (SIGKILL) as critical', () => {
      const result = detector.detect({
        toolName: 'bash',
        exitCode: 137,
        output: 'Killed',
      });
      expect(result.severity).toBe('critical');
    });

    it('should mark exit code 139 (SEGFAULT) as critical', () => {
      const result = detector.detect({
        toolName: 'bash',
        exitCode: 139,
        output: 'Segmentation fault',
      });
      expect(result.severity).toBe('critical');
    });
  });

  describe('Stderr Detection', () => {
    it('should detect error from stderr with error keywords', () => {
      const result = detector.detect({
        toolName: 'bash',
        stderr: 'Error: Something went wrong',
      });
      expect(result.detected).toBe(true);
      expect(result.signals.some((s) => s.type === 'stderr')).toBe(true);
    });

    it('should give lower weight to stderr without error keywords', () => {
      const resultWithKeywords = detector.detect({
        toolName: 'bash',
        stderr: 'Error: failed to connect',
      });
      const resultWithoutKeywords = detector.detect({
        toolName: 'bash',
        stderr: 'Debug: processing request',
      });

      const keywordWeight = resultWithKeywords.signals.find((s) => s.type === 'stderr')?.weight || 0;
      const noKeywordWeight = resultWithoutKeywords.signals.find((s) => s.type === 'stderr')?.weight || 0;

      expect(keywordWeight).toBeGreaterThan(noKeywordWeight);
    });
  });

  describe('Pattern Detection', () => {
    it('should detect TypeScript errors', () => {
      const result = detector.detect({
        toolName: 'tsc',
        output: "error TS2339: Property 'foo' does not exist on type 'Bar'",
      });
      expect(result.detected).toBe(true);
      expect(result.errorType).toBe('build');
    });

    it('should detect Rust compiler errors', () => {
      const result = detector.detect({
        toolName: 'cargo',
        output: 'error[E0425]: cannot find value `foo` in this scope',
      });
      expect(result.detected).toBe(true);
      expect(result.errorType).toBe('build');
    });

    it('should detect npm errors', () => {
      const result = detector.detect({
        toolName: 'npm',
        stderr: 'npm ERR! code ENOENT\nnpm ERR! syscall open',
      });
      expect(result.detected).toBe(true);
      expect(result.errorType).toBe('dependency');
    });

    it('should detect Module not found errors', () => {
      const result = detector.detect({
        toolName: 'node',
        output: "Cannot find module 'react'",
      });
      expect(result.detected).toBe(true);
      expect(result.errorType).toBe('dependency');
    });

    it('should detect permission errors', () => {
      const result = detector.detect({
        toolName: 'bash',
        output: 'EACCES: permission denied',
      });
      expect(result.detected).toBe(true);
      expect(result.errorType).toBe('permission');
    });

    it('should detect network errors', () => {
      const result = detector.detect({
        toolName: 'curl',
        stderr: 'ECONNREFUSED - Connection refused',
      });
      expect(result.detected).toBe(true);
      expect(result.errorType).toBe('network');
    });

    it('should detect test failures', () => {
      const result = detector.detect({
        toolName: 'jest',
        output: 'FAIL src/test.spec.ts\n5 failing',
      });
      expect(result.detected).toBe(true);
      expect(result.errorType).toBe('test');
    });
  });

  describe('Stack Trace Detection', () => {
    it('should detect JavaScript stack traces', () => {
      const result = detector.detect({
        toolName: 'node',
        output: `TypeError: Cannot read property 'foo' of undefined
    at Object.<anonymous> (/app/src/index.js:10:5)
    at Module._compile (node:internal/modules/cjs/loader:1254:14)
    at Module._extensions..js (node:internal/modules/cjs/loader:1308:10)`,
      });
      expect(result.detected).toBe(true);
      expect(result.signals.some((s) => s.type === 'stack_trace')).toBe(true);
    });

    it('should detect Python stack traces', () => {
      const result = detector.detect({
        toolName: 'python',
        output: `Traceback (most recent call last):
  File "/app/main.py", line 10, in <module>
  File "/app/utils.py", line 5, in helper
ValueError: invalid value`,
      });
      expect(result.detected).toBe(true);
      expect(result.signals.some((s) => s.type === 'stack_trace')).toBe(true);
    });

    it('should detect Java stack traces', () => {
      const result = detector.detect({
        toolName: 'java',
        output: `Exception in thread "main" java.lang.NullPointerException
  at com.example.App.main(App.java:15)
  at sun.reflect.NativeMethodAccessorImpl.invoke0(Native Method)`,
      });
      expect(result.detected).toBe(true);
    });
  });

  describe('Error Classification', () => {
    it('should classify TypeError', () => {
      const result = detector.detect({
        toolName: 'node',
        output: "TypeError: Cannot read properties of undefined",
      });
      expect(result.errorType).toBe('type_error');
    });

    it('should classify SyntaxError', () => {
      // SyntaxError matches build pattern first (SyntaxError: is in build patterns)
      // The classifyErrorType checks build patterns before syntax patterns
      const result = detector.detect({
        toolName: 'node',
        output: 'SyntaxError: Unexpected token',
      });
      expect(result.errorType).toBe('build');
    });

    it('should classify ReferenceError as runtime', () => {
      const result = detector.detect({
        toolName: 'node',
        output: 'ReferenceError: foo is not defined',
      });
      expect(result.errorType).toBe('runtime');
    });
  });

  describe('Confidence Calculation', () => {
    it('should have high confidence for multiple signals', () => {
      const result = detector.detect({
        toolName: 'node',
        exitCode: 1,
        stderr: 'Error: Something failed',
        output: `TypeError: x is undefined
    at foo (/app/index.js:10:5)
    at bar (/app/index.js:20:3)`,
      });
      expect(result.confidence).toBeGreaterThan(0.8);
    });

    it('should have moderate confidence for single signal', () => {
      const result = detector.detect({
        toolName: 'bash',
        exitCode: 1,
        output: 'Done',
      });
      expect(result.confidence).toBeLessThan(0.95);
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe('Privacy Filtering', () => {
    it('should sanitize API keys in error messages', () => {
      const result = detector.detect({
        toolName: 'node',
        output: 'Error: Invalid API key sk-abc123def456ghi789jkl012mno345pqr',
      });
      expect(result.errorMessage).toContain('[OPENAI_KEY_REDACTED]');
      expect(result.errorMessage).not.toContain('sk-');
    });

    it('should sanitize file paths in error messages', () => {
      const result = detector.detect({
        toolName: 'node',
        output: 'Error at /Users/developer/project/src/index.ts:42',
      });
      expect(result.errorMessage).toContain('~');
      expect(result.errorMessage).not.toContain('/Users/developer');
    });
  });

  describe('Default Instance', () => {
    it('should export a working default instance', () => {
      const result = defaultErrorDetector.detect({
        toolName: 'bash',
        exitCode: 1,
        stderr: 'Error: failed',
      });
      expect(result.detected).toBe(true);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty output', () => {
      const result = detector.detect({
        toolName: 'bash',
        exitCode: 0,
        output: '',
      });
      expect(result.detected).toBe(false);
    });

    it('should handle undefined fields', () => {
      const result = detector.detect({
        toolName: 'bash',
      });
      expect(result.detected).toBe(false);
    });

    it('should handle very long output', () => {
      const longOutput = 'Error: '.repeat(10000);
      const result = detector.detect({
        toolName: 'bash',
        output: longOutput,
      });
      expect(result.rawOutput.length).toBeLessThanOrEqual(5500);
    });
  });
});
