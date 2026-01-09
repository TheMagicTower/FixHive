# FixHive Agent Guidelines

## Development Commands

```bash
# Build
npm run build                    # ESM build with type declarations
npm run build:dts                # Build with type declarations only

# Development
npm run dev                      # Watch mode for development

# Type Checking
npm run typecheck                # TypeScript type checking

# Testing
npm test                         # Run all tests with Vitest
npm run test:coverage            # Run tests with coverage report

# Run Single Test
npx vitest run <path-to-test-file>      # Run specific test file
npx vitest run <path-to-test-file> -t "test name"  # Run specific test by name

# Linting
npm run lint                     # ESLint (if configured)
```

## Code Style Guidelines

### TypeScript Configuration
- Target: ES2022, Module: ESNext (bundler resolution)
- Strict mode enabled: `strict: true`
- No unused locals/parameters/implicit returns
- ESM modules only (use `.js` extensions in imports)

### Imports & Exports
```typescript
// Use explicit .js extensions for ESM
import { Type } from './types/index.js';
export { FunctionName };

// Group imports by type: external, internal modules, types
import { externalLibrary } from 'external-lib';
import { localModule } from './local-module.js';
import type { LocalType } from './local-types.js';
```

### Naming Conventions
- **Files**: `kebab-case.ts` (e.g., `error-detector.ts`)
- **Classes/Interfaces**: `PascalCase` (e.g., `ErrorDetector`, `CloudClient`)
- **Functions/Methods**: `camelCase` (e.g., `detectError`, `searchSimilar`)
- **Constants**: `SCREAMING_SNAKE_CASE` (e.g., `ERROR_PATTERNS`, `COMMUNITY_SUPABASE`)
- **Private Members**: `private` prefix not required, use TypeScript visibility modifiers
- **Types/Interfaces**: `PascalCase` with descriptive suffixes (e.g., `ErrorDetectionResult`, `LocalErrorRecord`)

### Formatting & Structure
- Use 2-space indentation (consistent with Prettier/TS default)
- Maximum line length: 100 characters (soft limit)
- Use JSDoc comments for public APIs and complex logic
- Use `const` by default, `let` only for reassignment

### Type Safety
- Always use explicit types for function parameters and return values
- Use `type` for simple unions/primitives, `interface` for object shapes
- Avoid `any`; use `unknown` for truly dynamic content with runtime checks
- Use discriminated unions for variant types

```typescript
// Good: Explicit types with proper exports
export function detectError(output: ToolOutput): ErrorDetectionResult {
  // ...
}

// Good: Discriminated union
type ErrorType = 'runtime' | 'build' | 'lint' | 'test';

// Avoid: Type assertions without runtime validation
const value = data as SomeType;  // ❌
```

### Error Handling
- Use try-catch blocks for async operations that may fail
- Never throw errors that expose sensitive information
- Graceful degradation: log errors but don't crash the plugin
- Return typed error objects when applicable

```typescript
// Good: Graceful error handling
try {
  const result = await cloudClient.searchSimilar(params);
  return result;
} catch (e) {
  const errorMessage = e instanceof Error ? e.message : 'Unknown error';
  console.error(`[FixHive] Cloud query failed: ${errorMessage}`);
  return emptyResult;  // Fallback to offline mode
}

// Bad: Throwing errors in plugin hooks
throw new Error('Failed to connect');  // ❌ Crashes the plugin
```

### Security Patterns
- **SQL**: Always use parameterized queries (prepared statements)
- **Regex**: Limit repetition to prevent ReDoS (e.g., `{10,500}` not `{10,}`)
- **State**: Reset regex `lastIndex` after global tests
- **Privacy**: Apply privacy filters before local storage AND cloud upload

```typescript
// Good: Parameterized SQL
const stmt = this.db.prepare('SELECT * FROM error_records WHERE id = ?');
const row = stmt.get(id);

// Good: ReDoS-safe regex
pattern: /\b(sk-[a-zA-Z0-9]{20,})\b/g,  // Fixed length range

// Good: Regex state reset
const regex = /pattern/g;
regex.test(string);
regex.lastIndex = 0;  // Reset for next test
```

### Testing Guidelines
- Test coverage: Core 99%, Storage 98%, Cloud 96%
- Tests in `tests/**/*.test.ts` matching `src/**/*.ts` structure
- Use Vitest globals (describe, it, expect, beforeEach, etc.)
- Test both happy paths and error cases
- Mock external dependencies (Supabase, OpenAI, filesystem)

```typescript
// Example test structure
describe('ErrorDetector', () => {
  beforeEach(() => {
    // Setup
  });

  it('should detect build errors from TypeScript output', () => {
    // Arrange
    const input = { tool: 'bash', output: 'error TS2307: Cannot find module' };

    // Act
    const result = detector.detect(input);

    // Assert
    expect(result.detected).toBe(true);
    expect(result.errorType).toBe('build');
  });
});
```

### Architecture Patterns
- **Core**: Pure functions and stateless classes (error-detector, privacy-filter, hash)
- **Storage**: LocalStore class with SQLite, migrations in separate file
- **Cloud**: CloudClient class with Supabase, embedding generation separate
- **Plugin**: OpenCode plugin hooks in `plugin/index.ts`, tools in `plugin/tools.ts`
- **Types**: All type definitions in `types/index.ts`

### Privacy & Security
- Never store or transmit sensitive data (API keys, tokens, emails, paths)
- Apply privacy filters to all error content before storage/upload
- Tool input is intentionally omitted from error records (contains sensitive data)
- Use placeholder replacements: `[API_KEY_REDACTED]`, `[EMAIL_REDACTED]`

### Code Review Checklist
- [ ] All imports use `.js` extensions
- [ ] Public functions have JSDoc comments
- [ ] Error handling is graceful (no crashes)
- [ ] SQL queries use parameterized statements
- [ ] Privacy filters applied before storage/upload
- [ ] No `any` types, explicit typing everywhere
- [ ] Tests added for new functionality
- [ ] Type checking passes: `npm run typecheck`
- [ ] Tests pass: `npm test`

## Project-Specific Notes

- **Plugin System**: OpenCode plugin v1.1.1 API
- **Database**: SQLite (better-sqlite3) with WAL mode
- **Cloud**: Supabase with pgvector for semantic search
- **Embeddings**: OpenAI text-embedding-3-small (1536 dimensions)
- **Node Version**: >=20.0.0
- **Package Scope**: @the-magic-tower
- **Testing**: Vitest with v8 coverage provider
