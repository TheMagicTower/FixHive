/**
 * FixHive - Community-based Error Knowledge Sharing for OpenCode
 *
 * CodeCaseDB v2.0
 *
 * @module @the-magic-tower/fixhive-opencode-plugin
 * @description
 * FixHive is an OpenCode plugin that automatically captures errors during
 * development sessions, queries a community knowledge base for solutions,
 * and shares resolved errors with other developers.
 *
 * @example
 * ```typescript
 * // In your OpenCode plugin configuration
 * import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';
 *
 * export default FixHivePlugin;
 * ```
 *
 * @example
 * ```bash
 * # Environment variables
 * FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
 * FIXHIVE_SUPABASE_KEY=your-anon-key
 * ```
 */

// NOTE: Do NOT export functions from main index.ts!
// OpenCode treats ALL exports as plugin instances and calls them.
// Only export the default plugin instance.

import FixHivePlugin from './plugin/index.js';
export default FixHivePlugin;

// Types from shared package (these are erased at runtime, so safe to export)
export type {
  CaseGroup,
  CaseVariant,
  Resolution,
  Vote,
  Device,
  Environment,
  SearchCasesInput,
  SearchCasesOutput,
  ReportResolutionInput,
  ReportResolutionOutput,
  VoteInput,
  VoteOutput,
  RankedVariant,
  FilterResult,
  CloudClient,
} from '@the-magic-tower/fixhive-shared';
