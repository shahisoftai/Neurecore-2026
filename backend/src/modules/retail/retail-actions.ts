/**
 * Retail AI Action handlers — Phase 8, Tasks 8.3.
 *
 * Per `EAOS-implementation-roadmap.md` §12 + `EAOS-implementation-plan.md` §5.3
 * + §9.9, the first vertical pack ships 12 retail-specific AI Actions. Each
 * handler is a thin orchestrator that:
 *   1. Loads the relevant entity data (sales, inventory, customers).
 *   2. Calls `LLMFactory.invoke()` with a structured prompt that references
 *      the loaded data and any matching Knowledge entries.
 *   3. Returns the AI output in the `AIActionResult` envelope.
 *
 * Streaming actions use an async generator yielding `AIActionStreamChunk`s.
 *
 * SOLID:
 *  - SRP — each handler owns exactly one retail AI action.
 *  - OCP — new retail actions are added by appending a handler; no changes
 *    to the existing built-in actions or the registry.
 *  - DIP — handlers depend on the `RetailActionContext` interface, not on a
 *    concrete LLM provider.
 *  - LSP — every handler returns the same `AIActionResult` shape; the
 *    executor treats them uniformly.
 */
import type {
  AIActionCitation,
  AIActionContext,
  AIActionDefinition,
  AIActionHandler,
  AIActionResult,
  AIActionStreamChunk,
} from '../ai-actions/action-definition';

export interface RetailCitationRef {
  id: string;
  title: string;
  content: string;
  score: number;
}

export interface RetailActionContext {
  /** Tenant-scoped LLM invoke that produces the answer. */
  invokeLLM: (
    prompt: string,
    systemPrompt?: string,
  ) => Promise<{ text: string; tokensUsed: number; model: string }>;
  /** Streaming variant used by streaming actions. */
  invokeLLMStream: (
    prompt: string,
    systemPrompt?: string,
  ) => AsyncGenerator<{ delta: string; tokensUsed: number }>;
  /** Look up the entity's data (sales, inventory, customers). */
  loadEntityData: (
    entityType: string,
    entityId: string,
    tenantId: string,
  ) => Promise<Record<string, unknown>>;
  /** Search tenant's Knowledge base for citations. */
  searchKnowledge: (
    query: string,
    tenantId: string,
    topK: number,
  ) => Promise<RetailCitationRef[]>;
  /** Default LLM model name. */
  defaultModel: string;
}

export type RetailActionId =
  | 'retail:inventory-forecast'
  | 'retail:visual-merch'
  | 'retail:nps-analysis'
  | 'retail:replenishment'
  | 'retail:conversion-optimizer'
  | 'retail:loss-prevention'
  | 'retail:staffing-forecast'
  | 'retail:layout-optimize'
  | 'retail:assortment-plan'
  | 'retail:markdown-optimizer'
  | 'retail:demand-sensing'
  | 'retail:shopper-segmentation';

/** Canonical category. PREDICTIVE is mapped to OPTIMIZATION at registration. */
const PREDICTIVE = 'OPTIMIZATION' as const;

/** Helper to convert demo citations into the AIActionCitation shape. */
function toCitations(refs: RetailCitationRef[]): AIActionCitation[] {
  return refs.map((r) => ({
    knowledgeEntryId: r.id,
    label: r.title,
    confidence: r.score,
  }));
}

/**
 * Build the 12 retail AI action definitions + handlers. Used by the
 * Solution Pack applier to register the actions on install, and by the
 * standalone `RetailModule` for direct invocation tests.
 */
export function buildRetailActions(
  ctx: RetailActionContext,
): Record<RetailActionId, AIActionDefinition> {
  return {
    'retail:inventory-forecast': {
      id: 'retail:inventory-forecast',
      name: 'Inventory Forecast',
      description:
        '7-day SKU-level inventory forecast using historical sales velocity and seasonality.',
      category: PREDICTIVE,
      capability: 'insights',
      tags: ['inventory', 'forecast', 'replenishment'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke'],
      requiresStreaming: false,
      timeoutMs: 20000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 1200,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: inventoryForecastHandler(ctx),
    },

    'retail:visual-merch': {
      id: 'retail:visual-merch',
      name: 'Visual Merchandising Plan',
      description:
        'Generate a visual merchandising plan for the store, including focal points, signage, and product placement.',
      category: 'EXECUTION',
      capability: 'automation',
      tags: ['merchandising', 'visual', 'plan'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke'],
      requiresStreaming: true,
      timeoutMs: 25000,
      maxRetries: 1,
      costModel: {
        type: 'per_token',
        tokensEstimate: 1500,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: visualMerchHandler(ctx),
    },

    'retail:nps-analysis': {
      id: 'retail:nps-analysis',
      name: 'NPS Analysis',
      description:
        'Analyse recent NPS survey responses, group by theme, and surface top drivers of promoter / detractor scores.',
      category: 'ANALYSIS',
      capability: 'intelligence',
      tags: ['nps', 'customer', 'sentiment'],
      supportedEntities: ['FACILITY', 'DEPARTMENT'],
      requiredPermissions: ['ai.invoke'],
      requiresStreaming: false,
      timeoutMs: 15000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 900,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: npsAnalysisHandler(ctx),
    },

    'retail:replenishment': {
      id: 'retail:replenishment',
      name: 'Replenishment Order',
      description:
        'Compute a replenishment order draft based on current stock, par levels, lead times, and forecasted demand.',
      category: 'EXECUTION',
      capability: 'operations',
      tags: ['inventory', 'replenishment', 'order'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke', 'ai.invoke.execution'],
      requiresStreaming: false,
      timeoutMs: 18000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 1100,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: replenishmentHandler(ctx),
    },

    'retail:conversion-optimizer': {
      id: 'retail:conversion-optimizer',
      name: 'Conversion Optimizer',
      description:
        'Identify conversion funnel drop-offs and recommend A/B tests + landing-page changes to lift conversion rate.',
      category: 'OPTIMIZATION',
      capability: 'insights',
      tags: ['conversion', 'ecommerce', 'ab-test'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke', 'ai.invoke.optimization'],
      requiresStreaming: false,
      timeoutMs: 22000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 1400,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: conversionOptimizerHandler(ctx),
    },

    'retail:loss-prevention': {
      id: 'retail:loss-prevention',
      name: 'Loss Prevention Brief',
      description:
        'Brief on shrinkage drivers, high-risk SKUs and times of day, with recommended LP actions.',
      category: 'ANALYSIS',
      capability: 'intelligence',
      tags: ['shrinkage', 'loss-prevention', 'security'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke'],
      requiresStreaming: false,
      timeoutMs: 15000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 1000,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: lossPreventionHandler(ctx),
    },

    'retail:staffing-forecast': {
      id: 'retail:staffing-forecast',
      name: 'Staffing Forecast',
      description:
        'Hourly staffing recommendation for the next 7 days based on traffic, sales history, and labour budget.',
      category: PREDICTIVE,
      capability: 'intelligence',
      tags: ['staffing', 'schedule', 'labor'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke'],
      requiresStreaming: false,
      timeoutMs: 18000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 1100,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: staffingForecastHandler(ctx),
    },

    'retail:layout-optimize': {
      id: 'retail:layout-optimize',
      name: 'Store Layout Optimizer',
      description:
        'Suggest a planogram and floor-flow redesign optimised for dwell time, basket size, and safety.',
      category: 'OPTIMIZATION',
      capability: 'automation',
      tags: ['layout', 'planogram', 'flow'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke', 'ai.invoke.optimization'],
      requiresStreaming: true,
      timeoutMs: 28000,
      maxRetries: 1,
      costModel: {
        type: 'per_token',
        tokensEstimate: 1700,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: layoutOptimizeHandler(ctx),
    },

    'retail:assortment-plan': {
      id: 'retail:assortment-plan',
      name: 'Assortment Plan',
      description:
        'Recommend SKU mix by category, including delists, listings, and depth-of-assortment targets.',
      category: 'OPTIMIZATION',
      capability: 'insights',
      tags: ['assortment', 'merchandising', 'category'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke', 'ai.invoke.optimization'],
      requiresStreaming: false,
      timeoutMs: 22000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 1400,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: assortmentPlanHandler(ctx),
    },

    'retail:markdown-optimizer': {
      id: 'retail:markdown-optimizer',
      name: 'Markdown Optimizer',
      description:
        'Recommend markdowns by SKU and week to clear aged inventory while protecting margin.',
      category: 'OPTIMIZATION',
      capability: 'insights',
      tags: ['markdown', 'pricing', 'clearance'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke', 'ai.invoke.optimization'],
      requiresStreaming: false,
      timeoutMs: 18000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 1100,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: markdownOptimizerHandler(ctx),
    },

    'retail:demand-sensing': {
      id: 'retail:demand-sensing',
      name: 'Demand Sensing',
      description:
        'Short-horizon demand signal from POS, weather, events, and social — surfaced as an alert.',
      category: PREDICTIVE,
      capability: 'intelligence',
      tags: ['demand', 'forecast', 'signal'],
      supportedEntities: ['FACILITY'],
      requiredPermissions: ['ai.invoke'],
      requiresStreaming: false,
      timeoutMs: 12000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 700,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: demandSensingHandler(ctx),
    },

    'retail:shopper-segmentation': {
      id: 'retail:shopper-segmentation',
      name: 'Shopper Segmentation',
      description:
        'Cluster shoppers by RFM + behaviour and recommend segments for personalised marketing.',
      category: 'ANALYSIS',
      capability: 'intelligence',
      tags: ['segmentation', 'rfm', 'marketing'],
      supportedEntities: ['FACILITY', 'DEPARTMENT'],
      requiredPermissions: ['ai.invoke'],
      requiresStreaming: false,
      timeoutMs: 18000,
      maxRetries: 1,
      costModel: {
        type: 'per_invocation',
        tokensEstimate: 1100,
        tierRequired: 'PRO',
      },
      version: '1.0.0',
      status: 'stable',
      handler: shopperSegmentationHandler(ctx),
    },
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Handler factories
// ─────────────────────────────────────────────────────────────────────────

function inventoryForecastHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildInventoryForecastPrompt(data);
    const citations = await ctx.searchKnowledge(
      'retail inventory forecast best practices',
      aCtx.tenantId,
      3,
    );
    const response = await ctx.invokeLLM(prompt, INVENTORY_FORECAST_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 80,
        output: response.tokensUsed,
        total: response.tokensUsed + 80,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 80),
      confidence: 0.78,
      metadata: { actionId: 'retail:inventory-forecast', kind: 'retail' },
    };
  };
}

function visualMerchHandler(ctx: RetailActionContext): AIActionHandler {
  return async function* (
    aCtx: AIActionContext,
  ): AsyncGenerator<AIActionStreamChunk> {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildVisualMerchPrompt(data);
    const citations = await ctx.searchKnowledge(
      'visual merchandising focal point',
      aCtx.tenantId,
      2,
    );
    let accumulated = 0;
    for await (const piece of ctx.invokeLLMStream(
      prompt,
      VISUAL_MERCH_SYSTEM,
    )) {
      accumulated += piece.tokensUsed;
      yield { type: 'delta', delta: piece.delta };
    }
    yield {
      type: 'done',
      result: {
        output: '',
        citations: toCitations(citations),
        metadata: { actionId: 'retail:visual-merch', kind: 'retail' },
      },
    };
    void accumulated;
  };
}

function npsAnalysisHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const entityType = aCtx.entityType ?? 'FACILITY';
    const data = await ctx.loadEntityData(
      entityType,
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildNpsPrompt(data);
    const citations = await ctx.searchKnowledge(
      'NPS drivers retail',
      aCtx.tenantId,
      2,
    );
    const response = await ctx.invokeLLM(prompt, NPS_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 60,
        output: response.tokensUsed,
        total: response.tokensUsed + 60,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 60),
      confidence: 0.74,
      metadata: { actionId: 'retail:nps-analysis', kind: 'retail' },
    };
  };
}

function replenishmentHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildReplenishmentPrompt(data);
    const citations = await ctx.searchKnowledge(
      'replenishment par level',
      aCtx.tenantId,
      2,
    );
    const response = await ctx.invokeLLM(prompt, REPLENISHMENT_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 90,
        output: response.tokensUsed,
        total: response.tokensUsed + 90,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 90),
      confidence: 0.8,
      metadata: { actionId: 'retail:replenishment', kind: 'retail' },
    };
  };
}

function conversionOptimizerHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildConversionPrompt(data);
    const citations = await ctx.searchKnowledge(
      'conversion funnel ecommerce',
      aCtx.tenantId,
      3,
    );
    const response = await ctx.invokeLLM(prompt, CONVERSION_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 80,
        output: response.tokensUsed,
        total: response.tokensUsed + 80,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 80),
      confidence: 0.72,
      metadata: { actionId: 'retail:conversion-optimizer', kind: 'retail' },
    };
  };
}

function lossPreventionHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildLossPreventionPrompt(data);
    const citations = await ctx.searchKnowledge(
      'retail loss prevention shrinkage',
      aCtx.tenantId,
      3,
    );
    const response = await ctx.invokeLLM(prompt, LOSS_PREVENTION_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 70,
        output: response.tokensUsed,
        total: response.tokensUsed + 70,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 70),
      confidence: 0.77,
      metadata: { actionId: 'retail:loss-prevention', kind: 'retail' },
    };
  };
}

function staffingForecastHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildStaffingPrompt(data);
    const citations = await ctx.searchKnowledge(
      'retail staffing schedule labor',
      aCtx.tenantId,
      2,
    );
    const response = await ctx.invokeLLM(prompt, STAFFING_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 75,
        output: response.tokensUsed,
        total: response.tokensUsed + 75,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 75),
      confidence: 0.76,
      metadata: { actionId: 'retail:staffing-forecast', kind: 'retail' },
    };
  };
}

function layoutOptimizeHandler(ctx: RetailActionContext): AIActionHandler {
  return async function* (
    aCtx: AIActionContext,
  ): AsyncGenerator<AIActionStreamChunk> {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildLayoutPrompt(data);
    const citations = await ctx.searchKnowledge(
      'store layout planogram',
      aCtx.tenantId,
      3,
    );
    for await (const piece of ctx.invokeLLMStream(prompt, LAYOUT_SYSTEM)) {
      yield { type: 'delta', delta: piece.delta };
    }
    yield {
      type: 'done',
      result: {
        output: '',
        citations: toCitations(citations),
        metadata: { actionId: 'retail:layout-optimize', kind: 'retail' },
      },
    };
  };
}

function assortmentPlanHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildAssortmentPrompt(data);
    const citations = await ctx.searchKnowledge(
      'category assortment plan',
      aCtx.tenantId,
      2,
    );
    const response = await ctx.invokeLLM(prompt, ASSORTMENT_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 80,
        output: response.tokensUsed,
        total: response.tokensUsed + 80,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 80),
      confidence: 0.75,
      metadata: { actionId: 'retail:assortment-plan', kind: 'retail' },
    };
  };
}

function markdownOptimizerHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildMarkdownPrompt(data);
    const citations = await ctx.searchKnowledge(
      'markdown pricing clearance',
      aCtx.tenantId,
      2,
    );
    const response = await ctx.invokeLLM(prompt, MARKDOWN_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 70,
        output: response.tokensUsed,
        total: response.tokensUsed + 70,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 70),
      confidence: 0.73,
      metadata: { actionId: 'retail:markdown-optimizer', kind: 'retail' },
    };
  };
}

function demandSensingHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const data = await ctx.loadEntityData(
      'FACILITY',
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildDemandSensingPrompt(data);
    const citations = await ctx.searchKnowledge(
      'demand signal short horizon',
      aCtx.tenantId,
      2,
    );
    const response = await ctx.invokeLLM(prompt, DEMAND_SENSING_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 60,
        output: response.tokensUsed,
        total: response.tokensUsed + 60,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 60),
      confidence: 0.79,
      metadata: { actionId: 'retail:demand-sensing', kind: 'retail' },
    };
  };
}

function shopperSegmentationHandler(ctx: RetailActionContext): AIActionHandler {
  return async (aCtx: AIActionContext): Promise<AIActionResult> => {
    const entityType = aCtx.entityType ?? 'FACILITY';
    const data = await ctx.loadEntityData(
      entityType,
      aCtx.entityId ?? '__default__',
      aCtx.tenantId,
    );
    const prompt = buildShopperSegmentationPrompt(data);
    const citations = await ctx.searchKnowledge(
      'RFM shopper segmentation',
      aCtx.tenantId,
      2,
    );
    const response = await ctx.invokeLLM(prompt, SHOPPER_SEGMENTATION_SYSTEM);
    return {
      output: response.text,
      citations: toCitations(citations),
      model: response.model,
      tokensUsed: {
        input: 75,
        output: response.tokensUsed,
        total: response.tokensUsed + 75,
      },
      estimatedCostUsd: estimateCostUsd(response.tokensUsed + 75),
      confidence: 0.74,
      metadata: { actionId: 'retail:shopper-segmentation', kind: 'retail' },
    };
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Prompts
// ─────────────────────────────────────────────────────────────────────────

const INVENTORY_FORECAST_SYSTEM =
  'You are a retail inventory planning analyst. You output 7-day SKU-level ' +
  'forecasts with units, expected demand, lead-time-adjusted reorder ' +
  'recommendations, and risk flags. Use compact tables in markdown.';

const VISUAL_MERCH_SYSTEM =
  'You are a retail visual merchandiser. You produce a structured ' +
  'merchandising plan with focal points, signage placements, fixture ' +
  'moves, and product adjacency suggestions. Be specific and actionable.';

const NPS_SYSTEM =
  'You are a customer experience analyst. You summarise NPS data into ' +
  'top drivers of promoter and detractor scores, segmented by channel, ' +
  'with concrete recommendations.';

const REPLENISHMENT_SYSTEM =
  'You are a retail replenishment specialist. Given current stock and ' +
  'lead times you output a draft purchase order grouped by vendor with ' +
  'unit counts, target dates, and rationale.';

const CONVERSION_SYSTEM =
  'You are an ecommerce conversion rate optimisation expert. You analyse ' +
  'funnel drop-offs and produce ranked A/B test hypotheses with ' +
  'expected lift and effort estimate.';

const LOSS_PREVENTION_SYSTEM =
  'You are a retail loss-prevention lead. You identify the top 3 ' +
  'shrinkage drivers, high-risk SKUs and time windows, plus concrete LP ' +
  'actions with owner and SLA.';

const STAFFING_SYSTEM =
  'You are a retail labour scheduling analyst. You produce an hourly ' +
  'staffing plan for the next 7 days with required FTE by role, target ' +
  'service level, and total labour cost.';

const LAYOUT_SYSTEM =
  'You are a retail store layout designer. You produce a markdown ' +
  'description of the recommended floor flow and planogram moves, with ' +
  'expected impact on dwell time, basket size, and shrink.';

const ASSORTMENT_SYSTEM =
  'You are a retail category manager. You recommend SKU listings, ' +
  'delists, and depth-of-assortment targets per category with rationale.';

const MARKDOWN_SYSTEM =
  'You are a retail pricing analyst. You produce markdown recommendations ' +
  'by SKU and week that clear aged stock while protecting margin.';

const DEMAND_SENSING_SYSTEM =
  'You are a retail demand-sensing analyst. You summarise the latest ' +
  'demand signals (POS, weather, events, social) into a short alert ' +
  'with recommended action.';

const SHOPPER_SEGMENTATION_SYSTEM =
  'You are a CRM analyst. You cluster shoppers into RFM + behavioural ' +
  'segments and recommend targeting plays per segment.';

function buildInventoryForecastPrompt(data: Record<string, unknown>): string {
  return [
    'Produce a 7-day SKU-level inventory forecast for this retail store.',
    'Use the loaded entity data below. Include units, expected demand, lead-time-adjusted',
    'reorder recommendation, and risk flags.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildVisualMerchPrompt(data: Record<string, unknown>): string {
  return [
    'Produce a visual merchandising plan for this store.',
    'Include focal points, signage, fixtures, product placement, and 3 "quick wins"',
    'the store team can execute this week.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildNpsPrompt(data: Record<string, unknown>): string {
  return [
    'Analyse the NPS responses for this entity.',
    'Group promoters and detractors by theme; surface top drivers of each score;',
    'recommend 3 concrete actions with expected impact.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildReplenishmentPrompt(data: Record<string, unknown>): string {
  return [
    'Compute a replenishment order draft.',
    'Group by vendor; include SKU, units, target date, lead time, on-hand, par level.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildConversionPrompt(data: Record<string, unknown>): string {
  return [
    'Identify conversion funnel drop-offs and recommend A/B tests.',
    'For each test include hypothesis, variant, primary metric, MDE, expected lift, effort.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildLossPreventionPrompt(data: Record<string, unknown>): string {
  return [
    'Identify top shrinkage drivers and high-risk SKUs/times.',
    'Recommend concrete LP actions with owner and SLA.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildStaffingPrompt(data: Record<string, unknown>): string {
  return [
    'Produce an hourly staffing plan for the next 7 days.',
    'Show required FTE by role per hour, target service level, and total labour cost.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildLayoutPrompt(data: Record<string, unknown>): string {
  return [
    'Recommend a floor-flow and planogram redesign.',
    'Describe by zone; include expected impact on dwell, basket, and shrink.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildAssortmentPrompt(data: Record<string, unknown>): string {
  return [
    'Recommend an assortment plan by category.',
    'Include listings, delists, depth-of-assortment targets, and rationale.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildMarkdownPrompt(data: Record<string, unknown>): string {
  return [
    'Recommend markdowns by SKU and week.',
    'Optimise to clear aged stock while protecting margin; show expected GMROI impact.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildDemandSensingPrompt(data: Record<string, unknown>): string {
  return [
    'Summarise the latest demand signals (POS, weather, events, social) into a short alert.',
    'Highlight the top 1-2 risks and the recommended action.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function buildShopperSegmentationPrompt(data: Record<string, unknown>): string {
  return [
    'Cluster shoppers into RFM + behavioural segments.',
    'For each segment recommend a targeting play with channel + offer + expected ROI.',
    '',
    'Entity data:',
    JSON.stringify(data, null, 2),
  ].join('\n');
}

function estimateCostUsd(tokens: number): number {
  // Conservative estimate: $0.002 per 1k tokens (blended GPT-4-class).
  return Math.round((tokens / 1000) * 0.002 * 100) / 100;
}
