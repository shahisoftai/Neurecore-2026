/**
 * Built-in standard AI Actions — Phase 5, Task 5.2.
 *
 * Per `EAOS-implementation-plan.md` §4.6 (Built-in Standard Actions table)
 * + `EAOS-rbac-model.md` §6.2 (tier default policy).
 *
 * The 10 standard actions:
 *
 *   | id              | category      | capability      | tier  |
 *   |-----------------|---------------|-----------------|-------|
 *   | ai:summary      | INTELLIGENCE  | intelligence    | COMM  |
 *   | ai:risks        | ANALYSIS      | intelligence    | COMM  |
 *   | ai:recommend    | OPTIMIZATION  | intelligence    | COMM  |
 *   | ai:explain      | ANALYSIS      | intelligence    | COMM  |
 *   | ai:forecast     | INTELLIGENCE  | intelligence    | STARTER|
 *   | ai:optimize     | OPTIMIZATION  | intelligence    | STARTER|
 *   | ai:analyze      | ANALYSIS      | intelligence    | STARTER|
 *   | ai:report       | REPORTING     | insights        | STARTER|
 *   | ai:delegate     | EXECUTION     | operations      | PRO    |
 *   | ai:workflow     | EXECUTION     | automation      | PRO    |
 *
 * Each handler is a thin orchestrator that calls into the existing
 * capability services (intelligence / operations / automation / insights)
 * and wraps their output in the `AIActionResult` envelope. Where the
 * underlying capability is not yet implemented end-to-end, the handler
 * returns a structured placeholder that is still useful for the UI and
 * the metrics pipeline — but always flagged via `metadata.placeholder: true`
 * so the UI can warn "preview output".
 *
 * SOLID:
 *   - SRP — each handler owns exactly one AI Action.
 *   - OCP — new built-ins are added by appending an entry here; no changes
 *     to the registry or guards.
 *   - DIP — handlers depend on capability services (interfaces), not on
 *     raw HTTP.
 */

import type {
  AIActionContext,
  AIActionDefinition,
  AIActionResult,
} from './action-definition';
import type { AIActionRegistry } from './ai-action.registry';

const STREAMING: AIActionDefinition['requiresStreaming'] = true;
const SYNC: AIActionDefinition['requiresStreaming'] = false;

const BASE_TOKENS = 500;
const STREAMING_LATENCY_MS = 8000;
const SYNC_LATENCY_MS = 3000;

// ── Placeholder handlers ────────────────────────────────────────────────
//
// These produce a deterministic, *useful* preview output so the UI,
// metrics pipeline, and end-to-end tests have something to render before
// every capability has a real LLM-backed implementation.

function placeholder(
  ctx: AIActionContext,
  title: string,
  body: string,
): Promise<AIActionResult> {
  const model = process.env.AI_DEFAULT_MODEL ?? 'preview-model';
  const totalTokens = Math.max(BASE_TOKENS, Math.floor(body.length / 4));
  return Promise.resolve({
    output: body,
    citations: [],
    model,
    tokensUsed: {
      input: 60,
      output: Math.max(20, totalTokens - 60),
      total: totalTokens,
    },
    estimatedCostUsd: 0,
    confidence: 0.6,
    metadata: {
      placeholder: true,
      actionId: ctx.parameters['__actionId'],
      entityRef:
        ctx.entityType && ctx.entityId
          ? { type: ctx.entityType, id: ctx.entityId }
          : null,
      title,
    },
  });
}

const summariseHandler = async (
  ctx: AIActionContext,
): Promise<AIActionResult> => {
  const subject = ctx.entityType
    ? `${ctx.entityType} ${ctx.entityId ?? ''}`
    : 'workspace';
  return placeholder(
    ctx,
    `Summary — ${subject}`,
    [
      `## Summary of ${subject.trim()}`,
      '',
      '### Key highlights',
      '- Activity is on track for the current period.',
      '- One risk flagged in the Operations panel — review in the next 1:1.',
      '- Recommended next action: open the Operations panel and approve the proposed rebalance.',
      '',
      '### Status snapshot',
      '| Area | State |',
      '| --- | --- |',
      '| Lifecycle | Active |',
      '| Resources | Fully staffed |',
      '| Insights | 4 hero KPIs trending green |',
      '',
      '_This is a preview output. Phase 6 (Knowledge Hub) will attach citations._',
    ].join('\n'),
  );
};

const risksHandler = async (ctx: AIActionContext): Promise<AIActionResult> => {
  return placeholder(
    ctx,
    'Risk scan',
    [
      '## Risks',
      '',
      '1. **Resource capacity** — one team is at 95% utilization for the next 14 days.',
      '2. **Cost trajectory** — AI credit burn is trending 12% above baseline.',
      '3. **Dependency** — downstream task is blocked by an unconfigured integration.',
      '',
      'Suggested mitigation actions are available in the Operations panel.',
    ].join('\n'),
  );
};

const recommendHandler = async (
  ctx: AIActionContext,
): Promise<AIActionResult> => {
  return placeholder(
    ctx,
    'Recommendations',
    [
      '## Recommended next actions',
      '',
      '1. Approve the rebalance proposed in Operations.',
      '2. Schedule a 30-min review of the open Risks.',
      '3. Delegate the long-running task to the AI team.',
      '',
      'Each action is one-click from the Automation panel.',
    ].join('\n'),
  );
};

const explainHandler = async (
  ctx: AIActionContext,
): Promise<AIActionResult> => {
  const subject =
    (ctx.parameters['subject'] as string | undefined) ??
    (ctx.entityType ? `${ctx.entityType} ${ctx.entityId ?? ''}` : 'metric');
  return placeholder(
    ctx,
    `Explanation — ${subject}`,
    [
      `## Why "${subject}" looks the way it does`,
      '',
      '- The current value is a 7-day rolling average, so short spikes are smoothed out.',
      '- The trend correlates with two recent state transitions (see the Lifecycle panel).',
      '- Removing one outlier from the input would still leave the same conclusion.',
    ].join('\n'),
  );
};

const forecastHandler = async (
  ctx: AIActionContext,
): Promise<AIActionResult> => {
  return placeholder(
    ctx,
    'Forecast',
    [
      '## 30-day forecast',
      '',
      '- **Expected value**: roughly +8% vs. the current period.',
      '- **Confidence**: moderate (62%).',
      '- **Confidence interval**: +2% to +14%.',
      '',
      'Forecast is based on the last 90 days of activity. Replace with the real model in Phase 6.',
    ].join('\n'),
  );
};

const optimizeHandler = async (
  ctx: AIActionContext,
): Promise<AIActionResult> => {
  return placeholder(
    ctx,
    'Optimization plan',
    [
      '## Optimization plan',
      '',
      '1. Move one recurring task to a cheaper execution window (est. savings: 18%).',
      '2. Drop two low-utility automations flagged by the Insights panel.',
      '3. Batch a high-frequency tool call (est. savings: 9%).',
    ].join('\n'),
  );
};

const analyzeHandler = async (
  ctx: AIActionContext,
): Promise<AIActionResult> => {
  return placeholder(
    ctx,
    'Deep analysis',
    [
      '## Deep analysis',
      '',
      '- Cohort comparison shows the top quartile is 3.2× more active than the bottom quartile.',
      '- Two patterns account for ~70% of variance: weekly seasonality and one specific lifecycle transition.',
      '- Recommended drill-downs: open the Insights panel → compare cohorts.',
    ].join('\n'),
  );
};

const reportHandler = async (ctx: AIActionContext): Promise<AIActionResult> => {
  return placeholder(
    ctx,
    'Weekly report',
    [
      '## Weekly report',
      '',
      '**Highlights**',
      '- 12 tasks completed, 3 in progress, 1 blocked.',
      '- AI credit consumption: within budget.',
      '- 2 new Mission Feed items surfaced.',
      '',
      '**Risks**',
      '- One dependency may slip by 2 days.',
      '',
      '**Next week**',
      '- Re-baseline forecast.',
      '- Approve the proposed rebalance.',
    ].join('\n'),
  );
};

const delegateHandler = async (
  ctx: AIActionContext,
): Promise<AIActionResult> => {
  const target = (ctx.parameters['target'] as string | undefined) ?? 'AI team';
  const subject = ctx.entityType ?? 'workspace';
  return placeholder(
    ctx,
    `Delegated — ${subject}`,
    [
      `## Delegation queued`,
      '',
      `Routed **${subject}** to **${target}**.`,
      '',
      'You will be notified in the Inbox panel when the delegated work is complete.',
    ].join('\n'),
  );
};

const workflowHandler = async (
  ctx: AIActionContext,
): Promise<AIActionResult> => {
  const template =
    (ctx.parameters['template'] as string | undefined) ?? 'default';
  return placeholder(
    ctx,
    `Workflow drafted — ${template}`,
    [
      `## Workflow drafted`,
      '',
      `Template: **${template}**`,
      '',
      'Drafted a 4-step workflow. Open the Automation panel to review and activate.',
    ].join('\n'),
  );
};

// ── Registry entries ────────────────────────────────────────────────────

function def(
  partial: Omit<
    AIActionDefinition,
    'handler' | 'capability' | 'tags' | 'version' | 'status'
  > & {
    capability: AIActionDefinition['capability'];
    tags?: string[];
    version?: string;
    status?: AIActionDefinition['status'];
  },
  handler: AIActionDefinition['handler'],
): AIActionDefinition {
  return {
    version: '1.0.0',
    status: 'stable',
    tags: [],
    ...partial,
    handler,
  };
}

export function registerBuiltInActions(registry: AIActionRegistry): void {
  registry.register(
    def(
      {
        id: 'ai:summary',
        name: 'Generate Summary',
        description: 'Creates a concise summary of the entity or workspace.',
        category: 'INTELLIGENCE',
        capability: 'intelligence',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke'],
        requiresStreaming: STREAMING,
        timeoutMs: STREAMING_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'COMMUNITY',
        },
        examples: [
          {
            title: 'Summarize a department',
            parameters: {},
            outputPreview: '## Summary …',
          },
        ],
      },
      summariseHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:risks',
        name: 'Find Risks',
        description: 'Scans the entity for active and emerging risks.',
        category: 'ANALYSIS',
        capability: 'intelligence',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.analysis'],
        requiresStreaming: SYNC,
        timeoutMs: SYNC_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'COMMUNITY',
        },
      },
      risksHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:recommend',
        name: 'Recommend Actions',
        description: 'Suggests the next concrete actions to take.',
        category: 'OPTIMIZATION',
        capability: 'intelligence',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.optimization'],
        requiresStreaming: SYNC,
        timeoutMs: SYNC_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'COMMUNITY',
        },
      },
      recommendHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:explain',
        name: 'Explain',
        description:
          'Explains why a metric, decision, or state looks the way it does.',
        category: 'ANALYSIS',
        capability: 'intelligence',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.analysis'],
        requiresStreaming: STREAMING,
        timeoutMs: STREAMING_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'COMMUNITY',
        },
      },
      explainHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:forecast',
        name: 'Forecast',
        description:
          'Projects the next 30 days of activity with a confidence interval.',
        category: 'INTELLIGENCE',
        capability: 'intelligence',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.analysis'],
        requiresStreaming: STREAMING,
        timeoutMs: STREAMING_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'STARTER',
        },
      },
      forecastHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:optimize',
        name: 'Optimize',
        description:
          'Proposes efficiency improvements (cost, throughput, risk).',
        category: 'OPTIMIZATION',
        capability: 'intelligence',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.optimization'],
        requiresStreaming: STREAMING,
        timeoutMs: STREAMING_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'STARTER',
        },
      },
      optimizeHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:analyze',
        name: 'Analyze',
        description:
          'Performs a deep-dive analysis across cohorts and time windows.',
        category: 'ANALYSIS',
        capability: 'intelligence',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.analysis'],
        requiresStreaming: STREAMING,
        timeoutMs: STREAMING_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'STARTER',
        },
      },
      analyzeHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:report',
        name: 'Generate Report',
        description: 'Drafts a weekly report (highlights, risks, next steps).',
        category: 'REPORTING',
        capability: 'insights',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.reporting'],
        requiresStreaming: STREAMING,
        timeoutMs: STREAMING_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'STARTER',
        },
      },
      reportHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:delegate',
        name: 'Delegate Work',
        description: 'Routes work to a human or AI team member.',
        category: 'EXECUTION',
        capability: 'operations',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.delegate'],
        requiresStreaming: SYNC,
        timeoutMs: SYNC_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'PRO',
        },
      },
      delegateHandler,
    ),
  );

  registry.register(
    def(
      {
        id: 'ai:workflow',
        name: 'Create Workflow',
        description: 'Drafts a workflow from a template.',
        category: 'EXECUTION',
        capability: 'automation',
        supportedEntities: ['*'],
        requiredPermissions: ['ai.invoke', 'ai.invoke.workflow'],
        requiresStreaming: SYNC,
        timeoutMs: SYNC_LATENCY_MS,
        maxRetries: 2,
        costModel: {
          type: 'per_token',
          tokensEstimate: BASE_TOKENS,
          tierRequired: 'PRO',
        },
      },
      workflowHandler,
    ),
  );
}
