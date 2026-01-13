/**
 * FixHive Custom Tools - CodeCaseDB v2.0
 *
 * OpenCode plugin tools for error knowledge management
 * 3 core tools: search_cases, report_resolution, vote
 */

import { tool } from '@opencode-ai/plugin';
import {
  hashSignature,
  filterSensitiveData,
  sanitizeStackTrace,
  NORMALIZATION_GUIDE,
} from '@the-magic-tower/fixhive-shared';
import type { Environment, CloudClient } from '@the-magic-tower/fixhive-shared';

interface FixHiveContext {
  sessionId: string;
  projectDirectory: string;
  language?: string;
  framework?: string;
  packages?: Record<string, string>;
}

/**
 * Create FixHive tools for OpenCode plugin
 */
export function createTools(
  cloudClient: CloudClient,
  context: FixHiveContext
): Record<string, ReturnType<typeof tool>> {
  return {
    /**
     * Search cloud knowledge base for error solutions
     */
    fixhive_search_cases: tool({
      description: `Search FixHive knowledge base for error solutions.

IMPORTANT: Before calling this tool, normalize the error message:
${NORMALIZATION_GUIDE}

Returns ranked solutions based on similarity, environment match, and community votes.`,
      args: {
        error_message: tool.schema.string().describe('The original error message'),
        error_signature: tool.schema
          .string()
          .optional()
          .describe('Normalized error signature (with placeholders like {class}, {file}, {id})'),
        language: tool.schema
          .string()
          .optional()
          .describe('Programming language (typescript, python, php, etc.)'),
        framework: tool.schema
          .string()
          .optional()
          .describe('Framework (react, nextjs, laravel, django, etc.)'),
        packages: tool.schema
          .object({})
          .optional()
          .describe('Key dependencies with versions'),
        limit: tool.schema.number().optional().describe('Maximum results (default: 5)'),
      },
      async execute(args, ctx) {
        context.sessionId = ctx.sessionID;

        const environment: Environment = {
          language: args.language || context.language || 'unknown',
          framework: args.framework || context.framework,
          packages: args.packages || context.packages,
        };

        const signatureHash = args.error_signature
          ? hashSignature(args.error_signature)
          : undefined;

        try {
          const result = await cloudClient.searchCases({
            error_message: args.error_message,
            error_signature: args.error_signature,
            environment,
            signature_hash: signatureHash,
            limit: args.limit || 5,
          });

          if (!result.group || result.variants.length === 0) {
            return JSON.stringify({
              found: false,
              message: 'No similar errors found in the knowledge base.',
              suggestions: [
                'Try normalizing the error message with placeholders',
                'Check if the error message is complete',
                'After resolving, use fixhive_report_resolution to contribute',
              ],
            });
          }

          return JSON.stringify({
            found: true,
            result: {
              groupId: result.group.id,
              errorSignature: result.group.error_signature,
              totalReports: result.group.total_reports,
              variantCount: result.variants.length,
              solutions: result.variants.map((v) => ({
                rank: v.rank,
                variantId: v.id,
                solution: v.solution,
                cause: v.cause,
                matchScore: Math.round(v.environment_match * 100) + '%',
                matchReason: v.match_reason,
                successRate: Math.round(v.success_rate * 100) + '%',
                votes: v.score,
                solutionSteps: v.solution_steps,
              })),
            },
            hint: 'Use fixhive_report_resolution to report whether a solution worked, or fixhive_vote to upvote/downvote.',
          });
        } catch (error) {
          return JSON.stringify({
            found: false,
            error: error instanceof Error ? error.message : 'Search failed',
          });
        }
      },
    }),

    /**
     * Report an error resolution
     */
    fixhive_report_resolution: tool({
      description: `Report an error resolution to the FixHive community knowledge base.

Use this tool after resolving an error to share your solution, or to confirm that an existing solution worked.

IMPORTANT: Before calling this tool, normalize the error signature:
${NORMALIZATION_GUIDE}`,
      args: {
        error_message: tool.schema.string().describe('The original error message'),
        error_signature: tool.schema
          .string()
          .describe('Normalized error signature (with placeholders)'),
        stack_trace: tool.schema
          .string()
          .optional()
          .describe('Stack trace (sensitive paths will be sanitized)'),
        cause: tool.schema.string().optional().describe('Root cause of the error'),
        solution: tool.schema.string().optional().describe('How the error was resolved'),
        solution_steps: tool.schema
          .array(tool.schema.string())
          .optional()
          .describe('Step-by-step resolution instructions'),
        code_diff: tool.schema
          .string()
          .optional()
          .describe('Code changes that fixed the issue'),
        language: tool.schema.string().optional().describe('Programming language'),
        framework: tool.schema.string().optional().describe('Framework'),
        packages: tool.schema.object({}).optional().describe('Key dependencies with versions'),
        solved: tool.schema
          .boolean()
          .optional()
          .describe('Whether the error was successfully resolved (default: true)'),
        used_variant_id: tool.schema
          .string()
          .optional()
          .describe('If an existing solution helped, provide its variant ID'),
        what_was_tried: tool.schema
          .string()
          .optional()
          .describe('What approaches were tried (useful even if not solved)'),
        time_spent: tool.schema.number().optional().describe('Minutes spent resolving'),
      },
      async execute(args, ctx) {
        context.sessionId = ctx.sessionID;

        // Filter sensitive data
        const filteredSolution = args.solution
          ? filterSensitiveData(args.solution)
          : undefined;
        const filteredCause = args.cause ? filterSensitiveData(args.cause) : undefined;
        const sanitizedStackTrace = args.stack_trace
          ? sanitizeStackTrace(args.stack_trace)
          : undefined;
        const filteredDiff = args.code_diff
          ? filterSensitiveData(args.code_diff)
          : undefined;

        const environment: Environment = {
          language: args.language || context.language || 'unknown',
          framework: args.framework || context.framework,
          packages: args.packages || context.packages,
        };

        try {
          const result = await cloudClient.reportResolution({
            error_message: args.error_message,
            error_signature: args.error_signature,
            stack_trace: sanitizedStackTrace,
            cause: filteredCause?.filtered,
            solution: filteredSolution?.filtered,
            solution_steps: args.solution_steps,
            code_diff: filteredDiff?.filtered,
            environment,
            solved: args.solved !== false,
            used_variant_id: args.used_variant_id,
            what_was_tried: args.what_was_tried,
            time_spent: args.time_spent,
          });

          if (!result.success) {
            return JSON.stringify({
              success: false,
              error: result.error || 'Failed to report resolution',
            });
          }

          const warnings: string[] = [];
          if (filteredSolution?.containsSensitive) {
            warnings.push('Some sensitive data was redacted from the solution');
          }
          if (filteredCause?.containsSensitive) {
            warnings.push('Some sensitive data was redacted from the cause');
          }

          return JSON.stringify({
            success: true,
            message: args.used_variant_id
              ? 'Thank you! Success count incremented for the existing solution.'
              : 'Thank you for contributing! Your resolution has been recorded.',
            resolutionId: result.resolution_id,
            groupId: result.group_id,
            variantId: result.variant_id,
            isNewGroup: result.is_new_group,
            isNewVariant: result.is_new_variant,
            warnings: warnings.length > 0 ? warnings : undefined,
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Report failed',
          });
        }
      },
    }),

    /**
     * Vote on a solution
     */
    fixhive_vote: tool({
      description: `Vote on a solution's quality or report inappropriate content.

Use this after trying a solution to help the community identify the best solutions.
- up: The solution was helpful
- down: The solution was not helpful or incorrect
- report: The content is inappropriate, spam, or harmful (requires reason)`,
      args: {
        variant_id: tool.schema.string().describe('The variant ID to vote on'),
        value: tool.schema
          .enum(['up', 'down', 'report'])
          .describe('Vote type: up (helpful), down (not helpful), or report'),
        reason: tool.schema
          .string()
          .optional()
          .describe('Required when reporting: explain why the content is inappropriate'),
      },
      async execute(args) {
        if (args.value === 'report' && !args.reason) {
          return JSON.stringify({
            success: false,
            error: 'Reason is required when reporting content',
          });
        }

        try {
          const result = await cloudClient.vote({
            variant_id: args.variant_id,
            value: args.value,
            reason: args.reason,
          });

          if (!result.success) {
            return JSON.stringify({
              success: false,
              error: result.error || 'Vote failed',
            });
          }

          const messages: Record<string, string> = {
            up: 'Thank you for your upvote! This helps other developers find useful solutions.',
            down: 'Thank you for your feedback. This helps improve solution quality.',
            report: 'Thank you for reporting. Our team will review this content.',
          };

          return JSON.stringify({
            success: true,
            message: messages[args.value],
            voteId: result.vote_id,
            previousVote: result.previous_vote,
            currentScore: result.current_score,
          });
        } catch (error) {
          return JSON.stringify({
            success: false,
            error: error instanceof Error ? error.message : 'Vote failed',
          });
        }
      },
    }),
  };
}

/**
 * Create offline-only tools when cloud is not configured
 */
export function createOfflineTools(
  _context: FixHiveContext
): Record<string, ReturnType<typeof tool>> {
  return {
    fixhive_search_cases: tool({
      description: 'Search FixHive knowledge base (requires cloud configuration)',
      args: {
        error_message: tool.schema.string().describe('The error message'),
      },
      async execute() {
        return JSON.stringify({
          found: false,
          message:
            'Cloud mode is disabled. Set FIXHIVE_SUPABASE_URL and FIXHIVE_SUPABASE_KEY to enable.',
          offline: true,
        });
      },
    }),
  };
}
