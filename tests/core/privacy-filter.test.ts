import { describe, it, expect, beforeEach } from 'vitest';
import { createPrivacyFilter, createFilterContext, defaultPrivacyFilter, type PrivacyFilter } from '../../src/core/privacy-filter.js';

describe('PrivacyFilter', () => {
  let filter: PrivacyFilter;

  beforeEach(() => {
    filter = createPrivacyFilter();
  });

  describe('API Keys', () => {
    it('should redact OpenAI API keys', () => {
      const content = 'Error: Invalid key sk-abc123def456ghi789jkl012mno345pqr678stu901vwx';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[OPENAI_KEY_REDACTED]');
      expect(result.sanitized).not.toContain('sk-');
      expect(result.appliedFilters).toContain('openai_key');
    });

    it('should redact AWS access keys', () => {
      const content = 'Using key AKIAIOSFODNN7EXAMPLE for AWS';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[AWS_KEY_REDACTED]');
      expect(result.sanitized).not.toContain('AKIAIOSFODNN7EXAMPLE');
    });

    it('should redact GitHub tokens', () => {
      const content = 'Using ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx for auth';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[GITHUB_TOKEN_REDACTED]');
      expect(result.sanitized).not.toContain('ghp_');
    });

    it('should redact Google API keys', () => {
      const content = 'Key: AIzaSyDaGmWKa4JsXZ-HjGw7ISLn_3namBGewQe';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[GOOGLE_API_KEY_REDACTED]');
    });

    it('should redact Stripe keys', () => {
      // Test pattern - build dynamically to avoid secret scanning
      const prefix = ['sk', 'live'].join('_') + '_';
      const suffix = 'abcdefghijklmnopqrstuvwxyz';
      const content = `stripe_key: ${prefix}${suffix}`;
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[STRIPE_KEY_REDACTED]');
    });
  });

  describe('JWT Tokens', () => {
    it('should redact JWT tokens', () => {
      const jwt = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
      const content = `Authorization: Bearer ${jwt}`;
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[JWT_REDACTED]');
      expect(result.sanitized).not.toContain('eyJhbGciOiJIUzI1NiI');
    });

    it('should redact Bearer tokens', () => {
      const content = 'Authorization: Bearer my-secret-token-12345';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[TOKEN_REDACTED]');
    });
  });

  describe('Email Addresses', () => {
    it('should redact email addresses', () => {
      const content = 'Error: User john.doe@example.com not found';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[EMAIL_REDACTED]');
      expect(result.sanitized).not.toContain('john.doe@example.com');
    });

    it('should handle multiple email addresses', () => {
      const content = 'Send to alice@test.com and bob@company.org';
      const result = filter.sanitize(content);
      expect(result.sanitized).toBe('Send to [EMAIL_REDACTED] and [EMAIL_REDACTED]');
      expect(result.redactedCount).toBe(2);
    });
  });

  describe('File Paths', () => {
    it('should redact macOS home paths', () => {
      const content = 'Error at /Users/johnsmith/projects/app/src/index.ts:42';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('~/projects/app/src/index.ts:42');
      expect(result.sanitized).not.toContain('/Users/johnsmith');
    });

    it('should redact Linux home paths', () => {
      const content = 'File not found: /home/developer/app/config.json';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('~/app/config.json');
      expect(result.sanitized).not.toContain('/home/developer');
    });

    it('should redact Windows home paths', () => {
      const content = 'Error: C:\\Users\\JohnDoe\\Documents\\project\\main.py';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('~\\Documents\\project\\main.py');
    });
  });

  describe('Database Connection Strings', () => {
    it('should redact PostgreSQL connection strings', () => {
      const content = 'Connection failed: postgresql://user:pass@localhost:5432/mydb';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('postgresql://[CONNECTION_REDACTED]');
      expect(result.sanitized).not.toContain('user:pass');
    });

    it('should redact MongoDB connection strings', () => {
      const content = 'mongodb://admin:secret@cluster0.mongodb.net/db';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('mongodb://[CONNECTION_REDACTED]');
    });

    it('should redact Redis connection strings', () => {
      const content = 'redis://default:password@redis-12345.cloud.redislabs.com:12345';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('redis://[CONNECTION_REDACTED]');
    });
  });

  describe('IP Addresses', () => {
    it('should redact public IP addresses', () => {
      const content = 'Server IP: 203.0.113.42';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[IP_REDACTED]');
    });

    it('should preserve localhost', () => {
      const content = 'Connecting to 127.0.0.1:3000';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('127.0.0.1');
    });

    it('should preserve 0.0.0.0', () => {
      const content = 'Listening on 0.0.0.0:8080';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('0.0.0.0');
    });

    it('should preserve private network IPs (192.168.x.x)', () => {
      const content = 'LAN IP: 192.168.1.100';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('192.168.1.100');
    });
  });

  describe('Environment Variables', () => {
    it('should redact sensitive environment variables', () => {
      const content = 'DATABASE_URL=postgres://user:pass@host/db';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[REDACTED]');
    });

    it('should redact API key environment variables', () => {
      const content = 'OPENAI_API_KEY=sk-12345abcdef';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[REDACTED]');
    });

    it('should not redact non-sensitive environment variables', () => {
      const content = 'NODE_ENV=production';
      const result = filter.sanitize(content);
      expect(result.sanitized).toBe('NODE_ENV=production');
    });
  });

  describe('Private Keys', () => {
    it('should redact RSA private keys', () => {
      const content = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAwJENcRev+eXZKvhhWLiV3Lz2MYOWOe5rVqr1sD+NXF
-----END RSA PRIVATE KEY-----`;
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[PRIVATE_KEY_REDACTED]');
      expect(result.sanitized).not.toContain('MIIEpAIBAAKCAQEAwJENcRev');
    });
  });

  describe('Path Generalization', () => {
    it('should replace project root with <PROJECT>', () => {
      const context = createFilterContext('/opt/project');
      const content = 'Error in /opt/project/src/app.ts';
      const result = filter.sanitize(content, context);
      expect(result.sanitized).toContain('<PROJECT>/src/app.ts');
    });

    it('should normalize node_modules paths', () => {
      const context = createFilterContext('/project');
      const content = 'Error in node_modules/@types/node/index.d.ts';
      const result = filter.sanitize(content, context);
      expect(result.sanitized).toContain('node_modules/<PKG>/');
    });

    it('should normalize site-packages paths', () => {
      const context = createFilterContext('/project');
      const content = 'Error in site-packages/requests/api.py';
      const result = filter.sanitize(content, context);
      expect(result.sanitized).toContain('site-packages/<PKG>/');
    });
  });

  describe('containsSensitiveData', () => {
    it('should detect OpenAI keys', () => {
      const content = 'key: sk-abc123def456ghi789jkl012mno345pqr678';
      expect(filter.containsSensitiveData(content)).toBe(true);
    });

    it('should detect AWS keys', () => {
      const content = 'AKIAIOSFODNN7EXAMPLE';
      expect(filter.containsSensitiveData(content)).toBe(true);
    });

    it('should return false for safe content', () => {
      const content = 'Error: Module not found: react';
      expect(filter.containsSensitiveData(content)).toBe(false);
    });
  });

  describe('Custom Rules', () => {
    it('should support adding custom rules', () => {
      filter.addRule({
        name: 'custom_id',
        category: 'secret',
        pattern: /CUSTOM_[A-Z0-9]{10}/g,
        replacement: '[CUSTOM_REDACTED]',
        priority: 100,
      });

      const content = 'ID: CUSTOM_ABC1234567';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('[CUSTOM_REDACTED]');
    });

    it('should support removing rules', () => {
      const removed = filter.removeRule('email');
      expect(removed).toBe(true);

      const content = 'Email: test@example.com';
      const result = filter.sanitize(content);
      expect(result.sanitized).toContain('test@example.com');
    });
  });

  describe('Default Instance', () => {
    it('should export a working default instance', () => {
      const content = 'sk-test12345678901234567890123456789012';
      const result = defaultPrivacyFilter.sanitize(content);
      expect(result.sanitized).toContain('[OPENAI_KEY_REDACTED]');
    });
  });

  describe('Multiple Patterns', () => {
    it('should handle content with multiple sensitive data types', () => {
      const content = `
        Key sk-abc123def456ghi789jkl012mno345pqr is invalid
        Email: user@company.com
        Path: /Users/developer/project
        DB: postgresql://admin:secret@localhost/db
      `;
      const result = filter.sanitize(content);

      expect(result.sanitized).toContain('[OPENAI_KEY_REDACTED]');
      expect(result.sanitized).toContain('[EMAIL_REDACTED]');
      expect(result.sanitized).toContain('~/project');
      expect(result.sanitized).toContain('postgresql://[CONNECTION_REDACTED]');
      expect(result.appliedFilters.length).toBeGreaterThan(3);
    });
  });
});
