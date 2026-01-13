# FixHive

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.zh.md">中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.nl.md">Nederlands</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@the-magic-tower/fixhive-opencode-plugin">
    <img src="https://img.shields.io/npm/v/@the-magic-tower/fixhive-opencode-plugin.svg" alt="npm version">
  </a>
  <a href="https://github.com/SeoulVentures/FixHive/actions/workflows/ci.yml">
    <img src="https://github.com/SeoulVentures/FixHive/actions/workflows/ci.yml/badge.svg" alt="CI Status">
  </a>
  <a href="https://opensource.org/licenses/MIT">
    <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  </a>
  <img src="https://img.shields.io/badge/Node.js-20%20%7C%2022-green" alt="Node.js Version">
</p>

> Community-based Error Knowledge Sharing for OpenCode (CodeCaseDB v2.0)

FixHive is an OpenCode plugin that automatically captures errors during development sessions, queries a community knowledge base for solutions, and shares resolved errors with other developers.

## Features

- **Auto Error Detection**: Automatically detects errors from tool outputs (bash, edit, etc.)
- **Cloud Knowledge Base**: Search community solutions using semantic similarity (pgvector)
- **AI-Guided Normalization**: Normalize error signatures for better matching
- **Environment Matching**: Solutions ranked by language, framework, and package compatibility
- **Privacy Filtering**: Automatically redacts sensitive data (API keys, paths, emails)
- **Community Voting**: Upvote/downvote solutions to help identify the best fixes

## Upgrading from v1.x

If you're upgrading from v1.x, please read the [Migration Guide](MIGRATION.md) for important changes:

- **Tool names changed**: `fixhive_search` → `fixhive_search_cases`, etc.
- **Local storage removed**: No more `.fixhive/` directory
- **Automatic device ID**: No need to set `FIXHIVE_CONTRIBUTOR_ID`
- **Environment matching**: Better solution ranking based on your stack

Quick upgrade:

```bash
# Update package
npm install @the-magic-tower/fixhive-opencode-plugin@latest

# Clean old data (optional)
rm -rf .fixhive/

# Remove old env vars (optional)
# FIXHIVE_CONTRIBUTOR_ID and OPENAI_API_KEY are no longer needed
```

## Installation

Add FixHive to your OpenCode configuration file (`opencode.json`):

```json
{
  "plugins": {
    "fixhive": {
      "name": "@the-magic-tower/fixhive-opencode-plugin@beta"
    }
  }
}
```

Then run OpenCode - the plugin will be automatically installed and loaded.

**That's it!** FixHive connects to the community knowledge base by default. No environment variables required.

You'll see these logs when the plugin loads successfully:
```
[FixHive] Starting plugin initialization (CodeCaseDB v2.0)
[FixHive] Plugin loaded
[FixHive] Project: /your/project/path
[FixHive] Cloud: enabled
[FixHive] Device: abc12345...
[FixHive] Ready - use fixhive_search_cases to find solutions
```

## How It Works

```
┌─────────────────────────────────────────────────────────────────┐
│                    FixHive Flow (v2.0)                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   1. Error Occurs                                               │
│      ↓                                                          │
│   2. AI Normalizes Error Signature                              │
│      ↓                                                          │
│   3. Cloud Search (Supabase + pgvector)                         │
│      ↓                                                          │
│   4. Environment Matching (language, framework, packages)       │
│      ↓                                                          │
│   5. Display Ranked Solutions (similarity + votes)              │
│      ↓                                                          │
│   6. Resolution → Upload to Community                           │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Configuration (Optional)

Environment variables to customize behavior:

```bash
# Use your own Supabase instance instead of community
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

| Variable | Default | Description |
|----------|---------|-------------|
| `FIXHIVE_SUPABASE_URL` | Community DB | Your Supabase project URL |
| `FIXHIVE_SUPABASE_KEY` | Community Key | Your Supabase anon key |

## Available Tools

### `fixhive_search_cases`

Search the knowledge base for error solutions.

```typescript
// Arguments
{
  error_message: string;     // Required: The error message to search for
  error_signature?: string;  // Optional: Normalized signature with placeholders
  language?: string;         // Optional: Programming language (typescript, python, etc.)
  framework?: string;        // Optional: Framework (react, nextjs, express, etc.)
  packages?: object;         // Optional: Key dependencies with versions
  limit?: number;            // Optional: Maximum results (default: 5)
}
```

**Example:**
```
fixhive_search_cases error_message="Cannot find module 'react'" language="typescript" framework="nextjs"
```

### `fixhive_report_resolution`

Report an error resolution to the community.

```typescript
// Arguments
{
  error_message: string;      // Required: Original error message
  error_signature: string;    // Required: Normalized signature
  solution?: string;          // Optional: How the error was resolved
  cause?: string;             // Optional: Root cause of the error
  solution_steps?: string[];  // Optional: Step-by-step resolution
  code_diff?: string;         // Optional: Code changes that fixed the issue
  language?: string;          // Optional: Programming language
  framework?: string;         // Optional: Framework
  packages?: object;          // Optional: Key dependencies
  used_variant_id?: string;   // Optional: If existing solution helped
}
```

**Example:**
```
fixhive_report_resolution error_message="Cannot find module 'react'" error_signature="Cannot find module '{module}'" solution="Added dependency to package.json"
```

### `fixhive_vote`

Vote on a solution's quality.

```typescript
// Arguments
{
  variant_id: string;  // Required: The variant ID to vote on
  value: 'up' | 'down' | 'report';  // Required: Vote type
  reason?: string;     // Required when reporting: Explain why
}
```

**Example:**
```
fixhive_vote variant_id="abc123" value="up"
```

## Error Signature Normalization

When searching or reporting errors, normalize the message by replacing variable parts with placeholders:

| Target | Placeholder | Example |
|--------|-------------|---------|
| Class names | `{class}` | `UserController` → `{class}` |
| File names | `{file}` | `index.ts:42` → `{file}:{id}` |
| Numeric IDs | `{id}` | `user_id: 12345` → `user_id: {id}` |
| UUIDs | `{uuid}` | `550e8400-e29b-...` → `{uuid}` |
| Timestamps | `{timestamp}` | `2024-01-15T10:30:00Z` → `{timestamp}` |
| File paths | `{path}` | `/home/user/project/` → `{path}` |
| DB identifiers | `{table}.{column}` | `users.email` → `{table}.{column}` |
| Routes | `{route}` | `/api/users/123` → `{route}` |
| Views | `{view}` | `admin.users.index` → `{view}` |

**Keep unchanged**: Framework classes, error codes (`SQLSTATE`, `TypeError`), package names

## Example Workflow

```
1. Run a command that fails
   $ npm run build
   > error TS2307: Cannot find module '@/components/Button'

2. Search for solutions
   fixhive_search_cases error_message="error TS2307: Cannot find module '@/components/Button'" error_signature="error TS2307: Cannot find module '{path}'" language="typescript" framework="nextjs"

3. Apply the top-ranked solution

4. Report your resolution
   fixhive_report_resolution error_message="..." error_signature="error TS2307: Cannot find module '{path}'" solution="Added path alias in tsconfig.json"

5. Vote on solutions that helped
   fixhive_vote variant_id="abc123" value="up"
```

## Privacy

FixHive automatically filters sensitive information before sharing:

| Category | Examples | Replacement |
|----------|----------|-------------|
| API Keys | `sk-abc123...`, `ghp_xxx...` | `[API_KEY_REDACTED]` |
| Tokens | `Bearer eyJ...`, `xoxb-...` | `[TOKEN_REDACTED]` |
| Emails | `user@example.com` | `[EMAIL_REDACTED]` |
| Paths | `/Users/john/projects/...` | `[PATH_REDACTED]` |
| Env Vars | `DATABASE_URL=postgres://...` | `[ENV_REDACTED]` |
| Connection Strings | `mongodb://user:pass@...` | `[CONNECTION_STRING_REDACTED]` |
| IP Addresses | `192.168.1.100` | `[IP_REDACTED]` |

## Self-Hosted Setup (Optional)

Skip this section if you're using the default community knowledge base.

### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project (Free tier works)
2. Wait for the project to be ready

### 2. Enable pgvector Extension

In SQL Editor, run:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 3. Run Setup Script

Copy and run the contents of `scripts/setup-codecasedb-v2.sql` in the SQL Editor.

### 4. Configure Environment

```bash
# Get these from Settings > API
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## Architecture

```
@the-magic-tower/fixhive-opencode-plugin
├── src/
│   ├── index.ts              # Main exports
│   └── plugin/
│       ├── index.ts          # Plugin definition (hooks)
│       └── tools.ts          # Custom tools (3 tools)
│
└── Shared Package (@the-magic-tower/fixhive-shared)
    ├── types/                # CaseGroup, CaseVariant, Resolution, Vote
    ├── device/               # device_id management
    ├── cloud/                # Supabase client, ranking algorithm
    └── utils/                # hash, privacy filtering
```

## Device Identification

FixHive uses a persistent device ID stored in `~/.codecasedb/device_id`. This ID:
- Is automatically generated on first use (UUID v4)
- Persists across sessions and projects
- Does not contain any personal information
- Used for vote deduplication and contribution tracking

## Ranking Algorithm

Solutions are ranked using:

```
final_score = env_match × 0.4 + success_rate × 0.3 + vote_score × 0.2 + report_factor × 0.1

env_match = language_match × 0.4 + framework_match × 0.4 + packages_overlap × 0.2
```

## Development

```bash
# Install dependencies
npm install

# Build (requires Bun)
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck

# Run tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing`)
5. Create a Pull Request

### Guidelines

- Write tests for new features
- Follow existing code style
- Update documentation
- Keep commits atomic

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for release history.

## License

MIT - see [LICENSE](LICENSE) for details.

## Related Packages

- [@the-magic-tower/fixhive-shared](https://github.com/TheMagicTower/fixhive-shared) - Shared utilities
- [@the-magic-tower/fixhive-claude-code](https://github.com/TheMagicTower/FixHive-ClaudeCode) - Claude Code MCP server

## Acknowledgments

- [OpenCode](https://github.com/opencode-ai/opencode) - AI coding assistant
- [Supabase](https://supabase.com) - Backend as a Service
- [pgvector](https://github.com/pgvector/pgvector) - Vector similarity search
