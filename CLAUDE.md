# CLAUDE.md

This file provides guidance to Claude Code when working with the FixHive codebase.

## Project Overview

FixHive is an OpenCode plugin for community-based error knowledge sharing (CodeCaseDB v2.0). It automatically captures errors during development sessions, queries a community knowledge base for solutions, and shares resolved errors with other developers.

**Package**: `@the-magic-tower/fixhive-opencode-plugin`
**npm**: https://www.npmjs.com/package/@the-magic-tower/fixhive-opencode-plugin
**GitHub**: https://github.com/TheMagicTower/FixHive

## Development Commands

```bash
# Install dependencies
npm install

# Build (ESM format with Bun)
npm run build

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
└── plugin/
    ├── index.ts          # Plugin definition & hooks
    └── tools.ts          # Custom OpenCode tools (3 tools)

# Shared package (../packages/shared)
packages/shared/
├── src/
│   ├── types/            # CaseGroup, CaseVariant, Resolution, Vote
│   ├── device/           # device_id management (~/.codecasedb/device_id)
│   ├── cloud/            # Supabase client, ranking algorithm
│   └── utils/            # hash, privacy filtering
```

### Data Flow

1. **Error Detection** (`tool.execute.after` hook)
   - Monitors bash, edit, write, read, terminal tools
   - Pattern-based detection with hints for AI

2. **Privacy Filtering** (from shared package)
   - Sanitizes API keys, tokens, emails, file paths, credentials
   - Applied before cloud transmission

3. **Cloud Knowledge** (Supabase + pgvector)
   - `case_groups`: Grouped errors by signature hash
   - `case_variants`: Environment-specific solutions
   - `resolutions`: Individual resolution reports
   - `votes`: Community voting

### Device Identification

FixHive uses a persistent device ID stored in `~/.codecasedb/device_id`. This ID:
- Is automatically generated on first use
- Persists across sessions
- Does not contain any personal information
- Used for vote deduplication and contribution tracking

## Error Signature Normalization

When using `fixhive_search_cases` or `fixhive_report_resolution`, normalize error messages to create reusable signatures:

### Normalization Rules

Replace variable parts with placeholders:
- `{class}` - Class/type names (e.g., `MyComponent`, `UserService`)
- `{file}` - File names (e.g., `index.ts`, `app.py`)
- `{id}` - Numeric IDs (e.g., `12345`)
- `{uuid}` - UUIDs (e.g., `550e8400-e29b-41d4-a716-446655440000`)
- `{timestamp}` - Timestamps (e.g., `2024-01-15T10:30:00Z`)
- `{path}` - File paths (e.g., `/Users/dev/project/src`)
- `{table}.{column}` - Database identifiers
- `{route}` - URL paths (e.g., `/api/users/123`)
- `{view}` - View/template names

### Examples

| Original Error | Normalized Signature |
|---------------|---------------------|
| `TypeError: Cannot read property 'name' of undefined at UserComponent.tsx:42` | `TypeError: Cannot read property 'name' of undefined at {file}:{id}` |
| `SQLSTATE[23000]: Duplicate entry '42' for key 'users.email'` | `SQLSTATE[23000]: Duplicate entry '{id}' for key '{table}.{column}'` |
| `Error: ENOENT: no such file or directory '/home/user/project/config.json'` | `Error: ENOENT: no such file or directory '{path}'` |

## Key Patterns

### OpenCode Plugin Hooks

```typescript
// src/plugin/index.ts
export const FixHivePlugin: Plugin = async (ctx) => {
  return {
    'tool.execute.after': async (input, output) => { /* error detection */ },
    'chat.message': async (input, output) => { /* session tracking */ },
    tool: { /* 3 custom tools */ },
  };
};
```

### Security Considerations

1. **Privacy Filtering**: Sensitive data redacted before cloud transmission
2. **ReDoS Prevention**: Regex patterns have length limits
3. **Graceful Degradation**: Cloud errors don't crash the plugin

### Custom Tools

| Tool | Description |
|------|-------------|
| `fixhive_search_cases` | Search knowledge base for error solutions |
| `fixhive_report_resolution` | Report an error resolution to community |
| `fixhive_vote` | Vote on solution quality (up/down/report) |

## Environment Variables

```bash
# Optional: Custom Supabase instance (defaults to community server)
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## Tech Stack

- **Language**: TypeScript (ES2022, ESM modules)
- **Bundler**: Bun
- **Cloud**: Supabase (PostgreSQL + pgvector)
- **Shared Package**: @the-magic-tower/fixhive-shared
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
   cat scripts/setup-codecasedb-v2.sql
   ```
3. Get project URL and anon key from Settings > API
4. Enable pgvector extension for semantic search

## Ranking Algorithm

Solutions are ranked using:

```
final_score = env_match × 0.4 + success_rate × 0.3 + vote_score × 0.2 + report_factor × 0.1

env_match = language_match × 0.4 + framework_match × 0.4 + packages_overlap × 0.1 × 2
```
