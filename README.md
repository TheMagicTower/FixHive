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

> Community-based Error Knowledge Sharing for OpenCode

FixHive is an OpenCode plugin that automatically captures errors during development sessions, queries a community knowledge base for solutions, and shares resolved errors with other developers.

## Features

- **Auto Error Detection**: Automatically detects errors from tool outputs (bash, edit, etc.)
- **Cloud Knowledge Base**: Search community solutions using semantic similarity (pgvector)
- **Local Caching**: SQLite-based local storage for offline access
- **Privacy Filtering**: Automatically redacts sensitive data (API keys, paths, emails)
- **Real-time Sync**: Immediate cloud communication on error/resolution

## Installation

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## Quick Start

Add to your OpenCode configuration (`opencode.config.ts`):

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

**That's it!** FixHive connects to the community knowledge base by default. No environment variables required.

## Configuration (Optional)

Environment variables to customize behavior:

```bash
# Use your own Supabase instance instead of community
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# Enable semantic search (recommended)
OPENAI_API_KEY=sk-...

# Custom contributor ID (auto-generated if not set)
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

| Variable | Default | Description |
|----------|---------|-------------|
| `FIXHIVE_SUPABASE_URL` | Community DB | Your Supabase project URL |
| `FIXHIVE_SUPABASE_KEY` | Community Key | Your Supabase anon key |
| `OPENAI_API_KEY` | None | Enables semantic similarity search |
| `FIXHIVE_CONTRIBUTOR_ID` | Auto-generated | Your unique contributor ID |

## Available Commands

| Command | Description |
|---------|-------------|
| `fixhive_search` | Search knowledge base for error solutions |
| `fixhive_resolve` | Mark error as resolved and share solution |
| `fixhive_list` | List errors in current session |
| `fixhive_vote` | Upvote/downvote a solution |
| `fixhive_stats` | View usage statistics |
| `fixhive_helpful` | Report a solution was helpful |
| `fixhive_report` | Report inappropriate content |

### Example Workflow

1. **Error occurs** → FixHive automatically detects and records it
2. **Search solutions** → `fixhive_search "Module not found: react"`
3. **Apply fix** → Follow community solution
4. **Share resolution** → `fixhive_resolve <error-id> "Installed missing dependency"`

## Self-Hosted Setup (Optional)

Skip this section if you're using the default community knowledge base.

To run your own FixHive backend:

1. Create a new Supabase project (Free tier works)
2. Run the setup script in SQL Editor:

```bash
cat scripts/setup-supabase.sql | pbcopy
# Paste in Supabase SQL Editor
```

3. Get your project URL and anon key from Settings > API
4. Set environment variables:

```bash
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## Architecture

```
FixHive Plugin
├── Error Detection (tool.execute.after hook)
├── Privacy Filter (redacts sensitive data)
├── Local Storage (SQLite)
│   ├── error_records
│   └── query_cache
└── Cloud Client (Supabase + pgvector)
    ├── knowledge_entries
    └── usage_logs
```

## Privacy

FixHive automatically filters sensitive information:

- API keys (OpenAI, GitHub, AWS, Stripe, etc.)
- JWT tokens and bearer tokens
- Email addresses
- File paths (replaced with `~` or `<PROJECT>`)
- Environment variables with sensitive names
- Database connection strings
- IP addresses (except localhost)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Watch mode
npm run dev

# Type check
npm run typecheck

# Run tests
npm test
```

## License

MIT

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request
