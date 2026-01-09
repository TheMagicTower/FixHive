/**
 * FixHive Custom Tools
 * OpenCode plugin tools for error knowledge management
 */

import { tool } from '@opencode-ai/plugin';
import type { LocalStore } from '../storage/local-store.js';
import type { CloudClient } from '../cloud/client.js';
import type { PrivacyFilter } from '../core/privacy-filter.js';
import type { FixHiveContext, CloudKnowledgeEntry, LocalErrorRecord } from '../types/index.js';

/**
 * Create FixHive tools for OpenCode plugin
 */
export function createTools(
  localStore: LocalStore,
  cloudClient: CloudClient,
  privacyFilter: PrivacyFilter,
  context: FixHiveContext
) {
  return {
    /**
     * Search cloud knowledge base for error solutions
     */
    fixhive_search: tool({
      description:
        'Search FixHive knowledge base for error solutions. Use when encountering errors to find community solutions.',
      args: {
        errorMessage: tool.schema.string().describe('The error message to search for'),
        language: tool.schema
          .string()
          .optional()
          .describe('Programming language (typescript, python, etc.)'),
        framework: tool.schema
          .string()
          .optional()
          .describe('Framework (react, nextjs, express, etc.)'),
        limit: tool.schema.number().optional().describe('Maximum results (default: 5)'),
      },
      async execute(args, ctx) {
        context.sessionId = ctx.sessionID;

        // Check local cache first
        const sanitized = privacyFilter.sanitize(args.errorMessage);
        const cachedResults = localStore.getCachedResults(sanitized.sanitized);

        if (cachedResults && cachedResults.length > 0) {
          return formatSearchResults(cachedResults, true);
        }

        // Search cloud
        const results = await cloudClient.searchSimilar({
          errorMessage: sanitized.sanitized,
          language: args.language as LocalErrorRecord['language'],
          framework: args.framework,
          limit: args.limit || 5,
        });

        if (results.results.length === 0) {
          return 'No matching solutions found in FixHive knowledge base.';
        }

        // Cache results
        localStore.cacheResults(sanitized.sanitized, results.results);

        return formatSearchResults(results.results, false);
      },
    }),

    /**
     * Mark error as resolved and optionally upload solution
     */
    fixhive_resolve: tool({
      description:
        'Mark an error as resolved and optionally share the solution with the community.',
      args: {
        errorId: tool.schema.string().describe('Error ID from fixhive_list'),
        resolution: tool.schema
          .string()
          .describe('Description of how the error was resolved'),
        resolutionCode: tool.schema
          .string()
          .optional()
          .describe('Code fix or diff that resolved the error'),
        upload: tool.schema
          .boolean()
          .optional()
          .describe('Upload solution to community (default: true)'),
      },
      async execute(args, ctx) {
        context.sessionId = ctx.sessionID;

        // Update local record
        const record = localStore.markResolved(args.errorId, {
          resolution: args.resolution,
          resolutionCode: args.resolutionCode,
        });

        if (!record) {
          return `Error with ID ${args.errorId} not found.`;
        }

        // Upload to cloud if requested
        if (args.upload !== false) {
          const uploadResult = await cloudClient.uploadResolution({
            errorRecord: record,
            resolution: args.resolution,
            resolutionCode: args.resolutionCode,
          });

          if (uploadResult.isDuplicate) {
            return `Error resolved locally. Similar solution already exists in FixHive (ID: ${uploadResult.existingId}).`;
          }

          if (uploadResult.success && uploadResult.knowledgeId) {
            localStore.markUploaded(args.errorId, uploadResult.knowledgeId);
            return `Error resolved and shared with FixHive community! Knowledge ID: ${uploadResult.knowledgeId}`;
          }

          return `Error resolved locally. Upload failed: ${uploadResult.message}`;
        }

        return 'Error marked as resolved locally.';
      },
    }),

    /**
     * List errors in current session
     */
    fixhive_list: tool({
      description: 'List errors detected in the current session.',
      args: {
        status: tool.schema
          .enum(['unresolved', 'resolved', 'uploaded'])
          .optional()
          .describe('Filter by status'),
        limit: tool.schema.number().optional().describe('Maximum results (default: 10)'),
      },
      async execute(args, ctx) {
        context.sessionId = ctx.sessionID;

        const errors = localStore.getSessionErrors(ctx.sessionID, {
          status: args.status as LocalErrorRecord['status'],
          limit: args.limit || 10,
        });

        if (errors.length === 0) {
          return 'No errors recorded in this session.';
        }

        return formatErrorList(errors);
      },
    }),

    /**
     * Vote on a solution
     */
    fixhive_vote: tool({
      description:
        'Upvote or downvote a FixHive solution based on whether it helped.',
      args: {
        knowledgeId: tool.schema.string().describe('Knowledge entry ID'),
        helpful: tool.schema
          .boolean()
          .describe('True for upvote, false for downvote'),
      },
      async execute(args) {
        const result = await cloudClient.vote(args.knowledgeId, args.helpful);

        if (!result.success) {
          if (result.error === 'Already voted') {
            return 'You have already voted on this solution.';
          }
          return `Vote failed: ${result.error}`;
        }

        return args.helpful
          ? 'Thanks for the feedback! Solution upvoted.'
          : 'Thanks for the feedback! Solution downvoted.';
      },
    }),

    /**
     * Report inappropriate content
     */
    fixhive_report: tool({
      description:
        'Report a FixHive solution for inappropriate content, spam, or incorrect information.',
      args: {
        knowledgeId: tool.schema.string().describe('Knowledge entry ID to report'),
        reason: tool.schema
          .string()
          .optional()
          .describe('Reason for reporting (spam, incorrect, inappropriate, etc.)'),
      },
      async execute(args) {
        const result = await cloudClient.reportEntry(args.knowledgeId, args.reason);

        if (!result.success) {
          return 'Failed to submit report. Please try again later.';
        }

        return 'Report submitted. Thank you for helping keep FixHive clean!';
      },
    }),

    /**
     * Get usage statistics
     */
    fixhive_stats: tool({
      description: 'Get FixHive usage statistics.',
      args: {},
      async execute() {
        const localStats = localStore.getStats();
        const cloudStats = await cloudClient.getContributorStats();

        return `
## FixHive Statistics

### Local
- Errors recorded: ${localStats.totalErrors}
- Resolved: ${localStats.resolvedErrors}
- Uploaded: ${localStats.uploadedErrors}

### Community Contributions
- Solutions shared: ${cloudStats.contributionCount}
- Times your solutions helped: ${cloudStats.helpedCount}
- Total upvotes received: ${cloudStats.totalUpvotes}
`;
      },
    }),

    /**
     * Report that a solution was helpful
     */
    fixhive_helpful: tool({
      description:
        'Report that a FixHive solution was helpful and resolved your issue.',
      args: {
        knowledgeId: tool.schema.string().describe('Knowledge entry ID that helped'),
      },
      async execute(args) {
        await cloudClient.reportHelpful(args.knowledgeId);
        return 'Thanks! Your feedback helps improve solution rankings.';
      },
    }),
  };
}

/**
 * Format search results for display
 */
function formatSearchResults(
  results: CloudKnowledgeEntry[],
  cached: boolean
): string {
  const header = cached
    ? `## FixHive Solutions Found (${results.length}) [Cached]`
    : `## FixHive Solutions Found (${results.length})`;

  const entries = results
    .map((r, i) => {
      const similarity = r.similarity
        ? ` (${Math.round(r.similarity * 100)}% match)`
        : '';

      let entry = `
### ${i + 1}. ${r.errorMessage.slice(0, 80)}...${similarity}
**Language:** ${r.language} | **Framework:** ${r.framework || 'N/A'} | **Upvotes:** ${r.upvotes}

**Resolution:**
${r.resolutionDescription}
`;

      if (r.resolutionCode) {
        entry += `
**Code Fix:**
\`\`\`
${r.resolutionCode}
\`\`\`
`;
      }

      if (r.resolutionSteps?.length) {
        entry += `
**Steps:**
${r.resolutionSteps.map((s, j) => `${j + 1}. ${s}`).join('\n')}
`;
      }

      entry += `
*ID: ${r.id}*

---`;

      return entry;
    })
    .join('\n');

  return `${header}\n${entries}\n\nUse \`fixhive_vote\` to rate solutions or \`fixhive_helpful\` if a solution resolved your issue.`;
}

/**
 * Format error list for display
 */
function formatErrorList(errors: LocalErrorRecord[]): string {
  const header = `## Session Errors (${errors.length})`;

  const table = `
| ID | Type | Status | Message |
|----|------|--------|---------|
${errors
  .map(
    (e) =>
      `| ${e.id.slice(0, 8)} | ${e.errorType} | ${e.status} | ${e.errorMessage.slice(0, 50)}... |`
  )
  .join('\n')}
`;

  return `${header}\n${table}\n\nUse \`fixhive_resolve <id>\` to mark as resolved and share solutions.`;
}
