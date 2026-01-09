# CLAUDE.md

This file provides guidance to Claude Code when working with the FixHive codebase.

## Project Overview

FixHive is an OpenCode plugin for community-based error knowledge sharing. It automatically captures errors during development sessions, queries a community knowledge base for solutions, and shares resolved errors with other developers.

**Package**: `@the-magic-tower/fixhive-opencode-plugin`
**npm**: https://www.npmjs.com/package/@the-magic-tower/fixhive-opencode-plugin
**GitHub**: https://github.com/TheMagicTower/FixHive

## Development Commands

```bash
# Install dependencies
npm install

# Build (ESM format)
npm run build

# Build with type declarations
npm run build:dts

# Watch mode for development
npm run dev

# Type checking
npm run typecheck

# Run tests
npm test

# Test with coverage
npm run test:coverage
```

## Architecture

```
src/
├── index.ts              # Main exports
├── plugin/
│   ├── index.ts          # Plugin definition & hooks
│   └── tools.ts          # Custom OpenCode tools
├── core/
│   ├── error-detector.ts # Error pattern matching
│   ├── privacy-filter.ts # Sensitive data removal
│   └── hash.ts           # Fingerprinting utilities
├── storage/
│   ├── local-store.ts    # SQLite local storage
│   └── migrations.ts     # Database schema
├── cloud/
│   ├── client.ts         # Supabase client
│   └── embedding.ts      # OpenAI embeddings
└── types/
    └── index.ts          # TypeScript definitions
```

### Data Flow

1. **Error Detection** (`tool.execute.after` hook)
   - Monitors bash, edit, write, read, terminal tools
   - Multi-signal detection: exit codes, stderr, error patterns, stack traces

2. **Privacy Filtering**
   - Sanitizes API keys, tokens, emails, file paths, credentials
   - Applied before local storage AND cloud transmission

3. **Local Storage** (SQLite)
   - `error_records`: Captured errors with status tracking
   - `query_cache`: Cached cloud query results
   - `usage_stats`: Usage statistics

4. **Cloud Knowledge** (Supabase + pgvector)
   - `knowledge_entries`: Community solutions with embeddings
   - `usage_logs`: Analytics and voting data
   - Semantic similarity search via pgvector

## Key Patterns

### OpenCode Plugin Hooks

```typescript
// src/plugin/index.ts
export const FixHivePlugin: Plugin = async (ctx) => {
  return {
    'tool.execute.after': async (input, output) => { /* error detection */ },
    'experimental.session.compacting': async (input, output) => { /* context preservation */ },
    'chat.message': async (input, output) => { /* session tracking */ },
    tool: { /* custom tools */ },
  };
};
```

### Security Considerations

1. **SQL Injection Prevention**: `LocalStore.incrementStat` uses whitelist validation
2. **ReDoS Prevention**: Privacy filter regex patterns have length limits
3. **Regex State Pollution**: `containsSensitiveData` resets lastIndex before/after testing
4. **Graceful Degradation**: Cloud errors don't crash the plugin

### Custom Tools

| Tool | Description |
|------|-------------|
| `fixhive_search` | Search knowledge base for solutions |
| `fixhive_resolve` | Mark error resolved & share solution |
| `fixhive_list` | List session errors |
| `fixhive_vote` | Vote on solution quality |
| `fixhive_stats` | View usage statistics |
| `fixhive_helpful` | Report helpful solution |

## Environment Variables

```bash
# Required for cloud features
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# Optional: For semantic search embeddings
OPENAI_API_KEY=sk-...

# Optional: Custom contributor ID
FIXHIVE_CONTRIBUTOR_ID=your-id
```

## Tech Stack

- **Language**: TypeScript (ES2022, ESM modules)
- **Bundler**: tsup
- **Local DB**: better-sqlite3
- **Cloud**: Supabase (PostgreSQL + pgvector)
- **Embeddings**: OpenAI text-embedding-3-small (1536 dims)
- **Plugin API**: @opencode-ai/plugin ^1.1.1

## Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Type check only
npm run typecheck
```

## Publishing

```bash
# Bump version
npm version patch|minor|major

# Build and publish
npm run build
npm publish --access public

# Create GitHub release
gh release create vX.Y.Z --generate-notes
```

## Cloud Setup (Supabase)

1. Create new Supabase project
2. Run setup script in SQL editor:
   ```bash
   cat scripts/setup-supabase.sql
   ```
3. Get project URL and anon key from Settings > API
4. Enable pgvector extension for semantic search
