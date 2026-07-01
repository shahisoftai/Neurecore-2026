/**
 * Agent Schemas — Structured output definitions using Zod
 *
 * SRP: Centralizes all LLM output schemas for type-safe parsing
 * OCP: Add new schemas without modifying existing code
 */

import { z } from 'zod';

// ─────────────────────────────────────────────────────────────
// Plan Schemas
// ─────────────────────────────────────────────────────────────

export const PlanStepSchema = z.object({
  id: z.string().describe('Unique step identifier'),
  description: z.string().describe('Human-readable step description'),
  toolId: z.string().optional().describe('Tool to execute, if any'),
  input: z.record(z.unknown()).optional().describe('Tool input parameters'),
  dependsOn: z
    .array(z.string())
    .optional()
    .describe('Step IDs that must complete first'),
});

export const AgentPlanSchema = z.object({
  goal: z.string().describe('Original goal statement'),
  steps: z.array(PlanStepSchema).describe('Ordered execution steps'),
  estimatedTokens: z
    .number()
    .int()
    .positive()
    .optional()
    .describe('Estimated token count'),
  reasoning: z.string().optional().describe('Why this plan was chosen'),
});

export type AgentPlanStructured = z.infer<typeof AgentPlanSchema>;

// ─────────────────────────────────────────────────────────────
// Evaluation Schemas
// ─────────────────────────────────────────────────────────────

export const StepEvaluationSchema = z.object({
  id: z.string().describe('Step identifier'),
  description: z.string().describe('What the step attempted'),
  output: z.unknown().optional().describe('Step output if successful'),
  success: z.boolean().describe('Whether step completed successfully'),
  error: z.string().optional().describe('Error message if failed'),
});

export const EvaluationResultSchema = z.object({
  score: z.number().min(0).max(1).describe('Quality score 0-1'),
  success: z.boolean().describe('Overall task success'),
  reflection: z.string().describe('One sentence summary'),
  suggestions: z.array(z.string()).describe('Improvement recommendations'),
  shouldRetry: z.boolean().describe('Whether to retry failed steps'),
  evaluatedSteps: z
    .array(StepEvaluationSchema)
    .optional()
    .describe('Per-step evaluation'),
});

export type EvaluationResultStructured = z.infer<typeof EvaluationResultSchema>;

// ─────────────────────────────────────────────────────────────
// Tool Call Schemas
// ─────────────────────────────────────────────────────────────

export const ToolCallArgumentSchema = z
  .record(z.unknown())
  .describe('Tool arguments');

export const ToolCallSchema = z.object({
  name: z.string().describe('Tool name to call'),
  arguments: ToolCallArgumentSchema.describe('Tool arguments as JSON object'),
});

export const ToolCallResponseSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z.string().optional(),
  durationMs: z.number().optional(),
});

export type ToolCallStructured = z.infer<typeof ToolCallSchema>;

// ─────────────────────────────────────────────────────────────
// Memory Schemas
// ─────────────────────────────────────────────────────────────

export const MemorySearchResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  importance: z.number().min(0).max(1),
  score: z.number().min(0).max(1).describe('Relevance score'),
  metadata: z.record(z.unknown()).optional(),
});

export const MemoryStoreResultSchema = z.object({
  id: z.string(),
  content: z.string(),
  summary: z.string().optional(),
  importance: z.number().min(0).max(1),
  success: z.boolean(),
});

// ─────────────────────────────────────────────────────────────
// ReAct Agent Schemas
// ─────────────────────────────────────────────────────────────

export const ReActThoughtSchema = z.object({
  thought: z.string().describe('Reasoning about current state'),
  action: z.string().describe('Tool name to use'),
  actionInput: z.record(z.unknown()).describe('Tool input parameters'),
  observation: z.string().optional().describe('Result of action'),
});

export const ReActAgentOutputSchema = z.object({
  thought: z.string(),
  action: z.string(),
  actionInput: z.record(z.unknown()),
  finalAnswer: z
    .string()
    .optional()
    .describe('Final response if task complete'),
  isComplete: z.boolean(),
});

export type ReActAgentOutput = z.infer<typeof ReActAgentOutputSchema>;

// ─────────────────────────────────────────────────────────────
// Streaming Event Schemas
// ─────────────────────────────────────────────────────────────

export const StreamingEventTypeSchema = z.enum([
  'token',
  'tool_call',
  'tool_result',
  'plan',
  'evaluation',
  'error',
  'complete',
]);

export const StreamingEventSchema = z.object({
  type: StreamingEventTypeSchema,
  data: z.unknown(),
  timestamp: z.number().int().positive(),
  traceId: z.string().optional(),
});

export type StreamingEvent = z.infer<typeof StreamingEventSchema>;

export const TokenEventSchema = StreamingEventSchema.extend({
  type: z.literal('token'),
  data: z.object({
    content: z.string(),
    isFinal: z.boolean().optional(),
  }),
});

export const ToolCallEventSchema = StreamingEventSchema.extend({
  type: z.literal('tool_call'),
  data: ToolCallSchema,
});

export const ToolResultEventSchema = StreamingEventSchema.extend({
  type: z.literal('tool_result'),
  data: ToolCallResponseSchema,
});

export const PlanEventSchema = StreamingEventSchema.extend({
  type: z.literal('plan'),
  data: AgentPlanSchema,
});

export const EvaluationEventSchema = StreamingEventSchema.extend({
  type: z.literal('evaluation'),
  data: EvaluationResultSchema,
});
