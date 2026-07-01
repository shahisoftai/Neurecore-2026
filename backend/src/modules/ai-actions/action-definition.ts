/**
 * AIActionDefinition — value object describing a single AI Action.
 *
 * Per `EAOS-implementation-plan.md` §4.6 (AI Action Registry) and
 * `EAOS-rbac-model.md` §6 (Action-Level Authorization).
 *
 * Each definition is registered once at boot (built-in actions) or
 * dynamically when a Solution Pack is installed (Phase 7). Definitions
 * are treated as immutable after registration; the registry never
 * mutates a definition in place — patches create a new registration.
 *
 * SOLID:
 * - SRP — this file only owns the *shape* of a definition; runtime
 *   enforcement lives in `ActionAuthorizationGuard`.
 * - OCP — new fields can be added without breaking existing callers
 *   (all optional except `id`, `name`, `handler`, `tierRequired`).
 */

export type AIActionCategory =
  'INTELLIGENCE' | 'ANALYSIS' | 'OPTIMIZATION' | 'EXECUTION' | 'REPORTING';

export type AIActionTierRequired =
  'COMMUNITY' | 'STARTER' | 'PRO' | 'ENTERPRISE';

export type AIActionCostType =
  'per_invocation' | 'per_token' | 'included_in_tier';

export interface AICostModel {
  /** Billing model. */
  type: AIActionCostType;
  /** Estimated tokens per invocation (used for budget / credit checks). */
  tokensEstimate: number;
  /** Minimum tier required to invoke. */
  tierRequired: AIActionTierRequired;
}

export interface AIActionExample {
  title: string;
  parameters: Record<string, unknown>;
  outputPreview: string;
}

export type AIActionPermission =
  | 'ai.invoke'
  | 'ai.invoke.analysis'
  | 'ai.invoke.optimization'
  | 'ai.invoke.execution'
  | 'ai.invoke.reporting'
  | 'ai.invoke.delegate'
  | 'ai.invoke.workflow';

export interface AIActionDefinition {
  /** Stable identifier (e.g. "ai:summary", "ai:forecast"). */
  id: string;
  /** Display name. */
  name: string;
  /** Human-readable description for the registry / Command Palette. */
  description: string;
  /** Classification used by the registry + UI filters. */
  category: AIActionCategory;
  /**
   * Capability this action belongs to. Drives where it surfaces
   * (Intelligence panel → INTELLIGENCE; Operations → EXECUTION; etc.).
   */
  capability:
    'intelligence' | 'operations' | 'insights' | 'automation' | 'collaboration';
  /** Free-form tags for discovery (`["summary", "briefing"]`). */
  tags: string[];

  /** Entity types this action supports. `['*']` = all. */
  supportedEntities: string[];
  /** Permissions the invoking user must have. */
  requiredPermissions: AIActionPermission[];

  /** Whether the action supports SSE streaming output. */
  requiresStreaming: boolean;
  /** Max execution time before the action is force-cancelled. */
  timeoutMs: number;
  /** Retry budget on transient failure. */
  maxRetries: number;

  /** Cost / governance model. */
  costModel: AICostModel;

  /** Lifecycle. */
  version: string;
  status: 'draft' | 'stable' | 'deprecated';

  /** Optional metadata. */
  author?: string;
  documentationUrl?: string;
  examples?: AIActionExample[];

  /**
   * The runtime executor. Receives a typed context and returns either
   * a structured result (sync path) or an async generator (streaming path).
   *
   * Implementations live in `./built-in.actions.ts` (Phase 5 built-ins)
   * or in Solution Pack `extensions/ai-actions/*.ts` (Phase 7).
   */
  handler: AIActionHandler;
}

/**
 * The runtime handler for an AI Action.
 *
 * Two execution modes:
 *   - Sync: returns a final `AIActionResult` (no streaming).
 *   - Streaming: returns an `AsyncGenerator` that yields delta chunks.
 *
 * The ActionExecutor chooses the mode based on `definition.requiresStreaming`.
 */
export type AIActionHandler = (
  ctx: AIActionContext,
) => Promise<AIActionResult> | AsyncGenerator<AIActionStreamChunk>;

export interface AIActionContext {
  /** Acting user id (from JWT). */
  userId: string;
  /** Acting user's role. */
  userRole: string;
  /** Acting tenant id (resolved via TenantContextService). */
  tenantId: string;
  /** Target entity type (e.g. "DEPARTMENT"). Optional. */
  entityType?: string;
  /** Target entity id. Optional. */
  entityId?: string;
  /** Action-specific parameters (validated upstream by `ActionAuthorizationGuard`). */
  parameters: Record<string, unknown>;
  /** Cancellation signal — abort the handler if the client disconnects. */
  signal?: AbortSignal;
}

export interface AIActionCitation {
  /** Knowledge entry id. */
  knowledgeEntryId: string;
  /** Short label shown in the chip (e.g. the entry title). */
  label: string;
  /** 0-1 confidence the citation supports the assertion. */
  confidence: number;
  /** Optional sub-span inside the entry (page, section). */
  span?: string;
}

export interface AIActionResult {
  /** Free-form structured output (Markdown string, JSON, etc.). */
  output: unknown;
  /** Citations referenced by the output (per NUWS §2.3). */
  citations?: AIActionCitation[];
  /** Model id used (for metrics + observability). */
  model?: string;
  /** Reported input / output token counts. */
  tokensUsed?: { input?: number; output?: number; total?: number };
  /** Reported cost in USD. */
  estimatedCostUsd?: number;
  /** 0-1 confidence shown in the UI thermometer. */
  confidence?: number;
  /** Optional structured metadata. */
  metadata?: Record<string, unknown>;
}

export interface AIActionStreamChunk {
  type: 'delta' | 'citation' | 'done' | 'error';
  /** Delta text when `type === 'delta'`. */
  delta?: string;
  /** Appended citation when `type === 'citation'`. */
  citation?: AIActionCitation;
  /** Final result when `type === 'done'`. */
  result?: AIActionResult;
  /** Error message when `type === 'error'`. */
  error?: string;
}
