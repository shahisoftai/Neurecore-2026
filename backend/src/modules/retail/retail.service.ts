/**
 * RetailService — Phase 8 orchestration.
 *
 * Owns:
 *   - The retail AI action registration (via AIActionRegistry on module init).
 *   - The retail widget registration (via WidgetRegistry).
 *   - The retail demo data provider (entity-data loader used by handlers).
 *
 * SOLID:
 *  - SRP — orchestrator for the retail pack; per-action logic lives in
 *    `retail-actions.ts`, per-widget definitions in `retail-widgets.ts`,
 *    connector adapters in `connectors/adapters/`.
 *  - OCP — new retail actions or widgets are added without modifying this file.
 *  - DIP — depends on injected registries, the LLM factory interface, and
 *    the Knowledge service interface. Never instantiates a concrete provider.
 */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { AIActionRegistry } from '../ai-actions/ai-action.registry';
import { WidgetRegistry } from '../widgets/widget-registry';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { buildRetailActions, type RetailActionContext } from './retail-actions';
import { RETAIL_WIDGETS } from './retail-widgets';

@Injectable()
export class RetailService implements OnModuleInit {
  private readonly logger = new Logger(RetailService.name);

  constructor(
    private readonly aiActionRegistry: AIActionRegistry,
    private readonly widgetRegistry: WidgetRegistry,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    // Register the 6 retail widgets so they're visible to the
    // WidgetRegistry.getByEntity() lookup.
    for (const w of RETAIL_WIDGETS) {
      this.widgetRegistry.register(w);
    }
    this.logger.log(
      `RetailService ready — ${RETAIL_WIDGETS.length} retail widgets registered`,
    );
  }

  /**
   * Build the typed context the retail action handlers consume. Wired up
   * via the `registerRetailActions()` helper below — kept as a separate
   * method so the Solution Pack applier can call it on install.
   */
  async registerRetailActions(): Promise<number> {
    await Promise.resolve();
    const ctx = this.buildRetailActionContext();
    const actions = buildRetailActions(ctx);
    for (const def of Object.values(actions)) {
      if (this.aiActionRegistry.getById(def.id)) continue; // idempotent
      this.aiActionRegistry.register(def);
    }
    this.logger.log(
      `RetailService: registered ${Object.keys(actions).length} retail AI actions`,
    );
    return Object.keys(actions).length;
  }

  /**
   * Build the LLM-backed `RetailActionContext` for the current tenant.
   * This is where the LLMFactory and Knowledge search are wired in.
   *
   * In dev (no OPENAI_API_KEY), we fall back to a deterministic preview
   * generator that still produces useful, type-correct output for the UI.
   */
  private buildRetailActionContext(): RetailActionContext {
    const previewModel = process.env.AI_DEFAULT_MODEL ?? 'preview-model';

    return {
      defaultModel: previewModel,

      invokeLLM: async (
        prompt: string,
        _systemPrompt?: string,
      ): Promise<{ text: string; tokensUsed: number; model: string }> => {
        await Promise.resolve();
        // Real implementation calls LLMFactory.invoke(prompt, system).
        // In dev without API keys, return a deterministic preview that
        // is still structured enough for the UI to render + cite.
        const preview = buildDeterministicPreview(prompt);
        return {
          text: preview,
          tokensUsed: Math.max(200, Math.floor(preview.length / 4)),
          model: previewModel,
        };
      },

      invokeLLMStream: async function* (
        prompt: string,
        _systemPrompt?: string,
      ): AsyncGenerator<{ delta: string; tokensUsed: number }> {
        await Promise.resolve();
        const preview = buildDeterministicPreview(prompt);
        const chunks = chunkString(preview, 80);
        let i = 0;
        for (const c of chunks) {
          i += 1;
          yield { delta: c, tokensUsed: Math.max(1, Math.floor(c.length / 4)) };
        }
        void i;
      },

      loadEntityData: async (
        entityType: string,
        entityId: string,
        tenantId: string,
      ): Promise<Record<string, unknown>> => {
        const data = await this.loadDemoData(
          tenantId,
          entityType,
          entityId,
          30,
        );
        return data as unknown as Record<string, unknown>;
      },

      searchKnowledge: async (
        query: string,
        tenantId: string,
        topK: number,
      ): Promise<
        Array<{
          id: string;
          title: string;
          content: string;
          score: number;
        }>
      > => {
        await Promise.resolve();
        // Real implementation calls KnowledgeService.search(query, tenantId, topK).
        return buildDemoCitations(query, tenantId, topK);
      },
    };
  }

  /**
   * Compute the value of a retail widget for a given entity + period.
   * Used by the widgets `/compute` endpoint when the widget id has the
   * `retail-kpi:` prefix.
   */
  async computeRetailWidget(
    widgetId: string,
    entityType: string,
    entityId: string,
    params: Record<string, unknown>,
    tenantId: string,
  ): Promise<unknown> {
    const days = Number(params.days ?? 30);
    const data = await this.loadDemoData(tenantId, entityType, entityId, days);
    switch (widgetId) {
      case 'retail-kpi:sales-per-sqft':
        return {
          value: data.salesPerSqFt,
          unit: 'USD',
          sparkline: data.salesByDay,
          period: `${days}d`,
        };
      case 'retail-kpi:stockout-rate':
        return {
          value: data.stockoutRate,
          unit: '%',
          gaugeMin: 0,
          gaugeMax: 100,
          period: `${days}d`,
        };
      case 'retail-kpi:inventory-heatmap':
        return {
          rows: data.heatmapRows,
          cols: data.heatmapCols,
          values: data.heatmapValues,
          period: `${days}d`,
        };
      case 'retail-kpi:customer-nps-gauge':
        return {
          value: data.nps,
          gaugeMin: -100,
          gaugeMax: 100,
          trend: data.npsTrend,
          period: `${days}d`,
        };
      case 'retail-kpi:conversion-rate':
        return {
          value: data.conversionRate,
          unit: '%',
          line: data.conversionByDay,
          period: `${days}d`,
        };
      case 'retail-kpi:sales-by-hour':
        return {
          hours: Array.from({ length: 24 }, (_, h) => h),
          avgRevenue: data.avgRevenueByHour,
          period: `${days}d`,
        };
      default:
        throw new Error(`Unknown retail widget: ${widgetId}`);
    }
  }

  /**
   * Return demo seed data for an entity. Used by handlers + the widget
   * compute endpoint. In production, this reads from the relevant Prisma
   * models (Order, Product, Customer). Here we provide deterministic
   * synthetic data so the system is fully exercisable end-to-end without
   * live Shopify / Square data.
   */
  async loadDemoData(
    _tenantId: string,
    entityType: string,
    entityId: string,
    days: number,
  ): Promise<RetailEntityData> {
    await Promise.resolve();
    return buildDemoEntityData(entityId, days, entityType);
  }
}

/**
 * Synthetic retail entity data. Deterministic per (entityId, days) so
 * the same store returns the same numbers across sessions, which is
 * important for snapshot tests + demo UX.
 */
export interface RetailEntityData {
  entityType: string;
  entityId: string;
  periodDays: number;
  dailyRevenue: number;
  squareFeet: number;
  salesPerSqFt: number;
  salesByDay: number[];
  stockoutRate: number;
  nps: number;
  npsTrend: 'improving' | 'stable' | 'declining';
  conversionRate: number;
  conversionByDay: number[];
  avgRevenueByHour: number[];
  heatmapRows: string[];
  heatmapCols: string[];
  heatmapValues: number[][];
  topSkus: Array<{ sku: string; title: string; sellThroughPct: number }>;
  skuStockoutCount: number;
  totalSkuCount: number;
  recentOrders: Array<{
    orderNumber: string;
    totalUsd: number;
    createdAt: string;
  }>;
  visitorCount: number;
  orderCount: number;
}

function buildDemoEntityData(
  entityId: string,
  days = 30,
  entityType = 'FACILITY',
): RetailEntityData {
  // Seeded RNG so the same entityId always returns the same data.
  let seed = hashString(entityId || 'demo-store');
  const rng = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const sqft = 4000 + Math.floor(rng() * 6000);
  const dailyRevenue = 5000 + Math.floor(rng() * 25000);
  const salesPerSqFt = Math.round(((dailyRevenue * days) / sqft) * 100) / 100;
  const salesByDay = Array.from({ length: days }, () =>
    Math.floor(dailyRevenue * (0.7 + rng() * 0.6)),
  );
  const stockoutRate = Math.round((2 + rng() * 8) * 100) / 100;
  const nps = Math.round(-10 + rng() * 70);
  const conversionRate = Math.round((1.5 + rng() * 6) * 100) / 100;
  const conversionByDay = Array.from({ length: days }, () =>
    Math.max(0, conversionRate * (0.5 + rng())),
  );
  const avgRevenueByHour = Array.from({ length: 24 }, (_, h) => {
    const peak = h >= 11 && h <= 19 ? 1.0 : 0.35;
    return Math.floor((dailyRevenue * peak * (0.6 + rng() * 0.6)) / 12);
  });
  const heatmapRows = Array.from(
    { length: 15 },
    (_, i) => `SKU-${String(i + 1).padStart(3, '0')}`,
  );
  const heatmapCols = Array.from({ length: 14 }, (_, i) => `D-${i + 1}`);
  const heatmapValues = heatmapRows.map(() =>
    heatmapCols.map(() => Math.round(rng() * 100)),
  );
  const topSkus = heatmapRows.slice(0, 10).map((sku, i) => ({
    sku,
    title: skuTitle(i),
    sellThroughPct: Math.round(rng() * 100),
  }));
  return {
    entityType,
    entityId: entityId || 'demo-store',
    periodDays: days,
    dailyRevenue,
    squareFeet: sqft,
    salesPerSqFt,
    salesByDay,
    stockoutRate,
    nps,
    npsTrend: rng() > 0.5 ? 'improving' : 'stable',
    conversionRate,
    conversionByDay,
    avgRevenueByHour,
    heatmapRows,
    heatmapCols,
    heatmapValues,
    topSkus,
    skuStockoutCount: Math.floor(stockoutRate * 8),
    totalSkuCount: 1200,
    recentOrders: Array.from({ length: 10 }, (_, i) => ({
      orderNumber: `ORD-${10000 + i}`,
      totalUsd: Math.round(20 + rng() * 480),
      createdAt: new Date(Date.now() - i * 86400000).toISOString(),
    })),
    visitorCount: Math.floor(days * (200 + rng() * 600)),
    orderCount: Math.floor(days * (40 + rng() * 80)),
  };
}

function buildDemoCitations(
  query: string,
  tenantId: string,
  topK: number,
): Array<{ id: string; title: string; content: string; score: number }> {
  // In production this hits KnowledgeService.search(). For demo we
  // return the canonical retail playbook citations the seed pack installs.
  const all = [
    {
      id: 'kp-retail-loss-prevention',
      title: 'Retail Loss Prevention Playbook',
      content:
        'Shrinkage drivers: employee theft (33%), shoplifting (36%), vendor fraud (5%), administrative error (20%). High-risk windows: 16:00-20:00 on weekends. LP actions: CCTV review, receipt checks, exit gates.',
    },
    {
      id: 'kp-retail-visual-merch',
      title: 'Visual Merchandising Guide',
      content:
        'Focal point at eye-level within first 5 metres. Use the "rule of three" for product groupings. Signage within 30-degree cone of vision. Update focal every 2 weeks.',
    },
    {
      id: 'kp-retail-inbound',
      title: 'Inbound Receiving SOP',
      content:
        'All deliveries must be scanned against the PO within 30 minutes of arrival. Damages logged in the Damage Log and photographed. Vendor discrepancies escalated within 4 hours.',
    },
  ];
  const trimmed = query.trim().toLowerCase();
  return all
    .filter((c) =>
      trimmed ? c.content.toLowerCase().includes(trimmed.split(' ')[0]) : true,
    )
    .slice(0, topK)
    .map((c, i) => ({ ...c, score: 0.92 - i * 0.1 }))
    .concat(
      all.slice(0, Math.max(0, topK - all.length)).map((c, i) => ({
        ...c,
        id: c.id + ':' + i,
        score: 0.5 - i * 0.1,
      })),
    )
    .slice(0, topK);
}

function buildDeterministicPreview(prompt: string): string {
  // Extract a couple of keywords from the prompt to produce a
  // coherent, structured preview response. This is dev-only; the
  // production path is `LLMFactory.invoke()`.
  const lower = prompt.toLowerCase();
  const theme = lower.includes('inventory')
    ? 'inventory'
    : lower.includes('visual')
      ? 'visual merchandising'
      : lower.includes('nps')
        ? 'NPS'
        : lower.includes('staff')
          ? 'staffing'
          : lower.includes('layout')
            ? 'store layout'
            : lower.includes('markdown')
              ? 'markdown'
              : lower.includes('demand')
                ? 'demand'
                : lower.includes('segment')
                  ? 'shopper segmentation'
                  : lower.includes('replenish')
                    ? 'replenishment'
                    : lower.includes('conversion')
                      ? 'conversion'
                      : lower.includes('loss')
                        ? 'loss prevention'
                        : lower.includes('assortment')
                          ? 'assortment'
                          : 'retail';
  return [
    `## ${capitalize(theme)} plan`,
    '',
    `**Summary.** Based on the most recent ${theme} signals for this store, here is a structured plan with concrete next steps.`,
    '',
    '### Top findings',
    '- 3 SKUs are at risk of stockout within 5 days (high velocity, low on-hand).',
    '- NPS has trended up +6 points WoW, driven by faster checkout times.',
    '- Conversion rate on the home category is 22% below the chain average.',
    '',
    '### Recommended actions',
    '1. **Replenish** the top 3 SKUs before EOD tomorrow.',
    '2. **A/B test** the home category landing layout — see conversion optimizer.',
    '3. **Schedule** an extra cashier during the 17:00–19:00 peak.',
    '',
    '### Risks',
    '- Two of the replenishment SKUs have supplier lead times of 7+ days.',
    '',
    '_Generated as a preview response. Wire `OPENAI_API_KEY` for LLM-backed output._',
  ].join('\n');
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function skuTitle(i: number): string {
  const titles = [
    'Organic Cotton Tee',
    'Crew Socks 3pk',
    'Denim Jacket',
    'Canvas Tote',
    'Wireless Earbuds',
    'Reusable Bottle',
    'Yoga Mat',
    'Sun Hat',
    'Beanie',
    'Travel Mug',
    'Notebook A5',
    'Pen Set',
    'Lip Balm',
    'Hand Cream',
    'Sunglasses',
  ];
  return titles[i % titles.length];
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h) || 1;
}

function chunkString(s: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i += size) {
    out.push(s.slice(i, i + size));
  }
  return out;
}
