# Migration Guide: v1.x to v2.0 (CodeCaseDB v2.0)

This guide helps existing FixHive users upgrade to version 2.0.

## Breaking Changes Summary

| Area | v1.x | v2.0 |
|------|------|------|
| **Tools** | 7 tools | 3 tools |
| **Local Storage** | SQLite (.fixhive/) | None (cloud-only) |
| **Identification** | contributor_id (env var) | device_id (auto-generated file) |
| **Search** | Keyword matching | Signature-based + environment matching |
| **Error Reporting** | Automatic | Manual with AI-guided normalization |

## Step-by-Step Migration

### 1. Update Package Version

```bash
npm install @the-magic-tower/fixhive-opencode-plugin@latest
```

Or for Claude Code:

```bash
npm install -g @the-magic-tower/fixhive-claude-code@latest
```

### 2. Clean Up Old Data (Optional)

The old SQLite database is no longer used. You can safely delete it:

```bash
# For OpenCode
rm -rf .fixhive/

# The directory is typically in your project root
```

### 3. Update Environment Variables

**Removed Variables:**
- `FIXHIVE_CONTRIBUTOR_ID` - No longer needed (device_id is auto-generated)
- `OPENAI_API_KEY` - No longer needed for embeddings

**Unchanged Variables:**
- `FIXHIVE_SUPABASE_URL` - Still works for custom Supabase instances
- `FIXHIVE_SUPABASE_KEY` - Still works for custom Supabase instances

```bash
# Before (v1.x)
FIXHIVE_CONTRIBUTOR_ID=my-contributor-id
OPENAI_API_KEY=sk-...

# After (v2.0) - These can be removed
# Device ID is now auto-generated at ~/.codecasedb/device_id
```

### 4. Update Tool Usage

#### Search for Solutions

**Before (v1.x):**
```
fixhive_search "Cannot find module 'react'"
```

**After (v2.0):**
```
fixhive_search_cases error_message="Cannot find module 'react'" error_signature="Cannot find module '{module}'" language="typescript"
```

Key differences:
- New tool name: `fixhive_search_cases`
- Added `error_signature` parameter for normalized signatures
- Added environment parameters: `language`, `framework`, `packages`

#### Report Resolution

**Before (v1.x):**
```
fixhive_resolve <error-id> "Fixed by adding dependency"
```

**After (v2.0):**
```
fixhive_report_resolution error_message="Cannot find module 'react'" error_signature="Cannot find module '{module}'" solution="Fixed by adding dependency"
```

Key differences:
- New tool name: `fixhive_report_resolution`
- No longer needs error ID (uses signature matching)
- Requires normalized `error_signature`
- Optional: `cause`, `solution_steps`, `code_diff`

#### Vote on Solutions

**Before (v1.x):**
```
fixhive_vote <knowledge-id> helpful=true
```

**After (v2.0):**
```
fixhive_vote variant_id="<variant-id>" value="up"
```

Key differences:
- Uses `variant_id` instead of `knowledge_id`
- Uses `value` enum: "up", "down", "report"
- Report option requires `reason` parameter

### 5. Removed Tools

The following tools have been removed in v2.0:

| Removed Tool | Replacement |
|--------------|-------------|
| `fixhive_list` | Not needed - no local storage |
| `fixhive_stats` | Not needed - no local storage |
| `fixhive_helpful` | Use `fixhive_report_resolution` with `used_variant_id` |
| `fixhive_report` | Use `fixhive_vote` with `value="report"` |

### 6. Learn Error Signature Normalization

v2.0 relies on AI-guided normalization for better matching. Learn the placeholder system:

| Target | Placeholder | Example |
|--------|-------------|---------|
| Class names | `{class}` | `UserController` → `{class}` |
| File names | `{file}` | `index.ts` → `{file}` |
| Numeric IDs | `{id}` | `12345` → `{id}` |
| UUIDs | `{uuid}` | `550e8400-...` → `{uuid}` |
| File paths | `{path}` | `/home/user/project/` → `{path}` |
| DB identifiers | `{table}.{column}` | `users.email` → `{table}.{column}` |

**Keep unchanged:** Framework classes, error codes, package names

### 7. New Device Identification

v2.0 uses a persistent device ID stored at `~/.codecasedb/device_id`:

- Auto-generated on first use (UUID v4)
- Persists across sessions and projects
- Used for vote deduplication
- No personal information included

If you need to reset your device ID:

```bash
rm ~/.codecasedb/device_id
# A new one will be generated on next use
```

## Database Migration (Self-Hosted Users)

If you're running your own Supabase instance, you need to run the new schema:

1. **Backup existing data** (optional, as schema is completely new)

2. **Run new schema:**
   ```sql
   -- Run the contents of scripts/setup-codecasedb-v2.sql
   ```

3. **Note:** Old data (errors, solutions, votes) is not migrated. The v2.0 schema uses a completely different data model.

## New Features in v2.0

### Environment Matching

Solutions are now ranked by how well they match your environment:

```
final_score = env_match × 0.4 + success_rate × 0.3 + vote_score × 0.2 + report_factor × 0.1
```

This means solutions from similar projects (same language, framework, packages) rank higher.

### Success Rate Tracking

When you report that an existing solution worked (using `used_variant_id`), it increases the solution's success rate.

### Improved Privacy

All sensitive data filtering now happens before cloud transmission, not at storage time.

## Troubleshooting

### "Tool not found" errors

Update your tool calls to use the new names:
- `fixhive_search` → `fixhive_search_cases`
- `fixhive_resolve` → `fixhive_report_resolution`
- `fixhive_vote` (same name, different parameters)

### No local data

v2.0 is cloud-only. Your local error history is no longer available. Use `fixhive_search_cases` to find community solutions.

### Device ID issues

If you see permission errors:

```bash
mkdir -p ~/.codecasedb
chmod 700 ~/.codecasedb
```

## Getting Help

- GitHub Issues: https://github.com/TheMagicTower/FixHive/issues
- Documentation: See README.md and CLAUDE.md
