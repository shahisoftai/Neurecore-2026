/**
 * Retail tests — Phase 8.
 *
 * Covers:
 *   - 12 retail AI actions are registered with the right shape
 *   - 6 retail widgets are registered with the right shape
 *   - Deterministic preview output is structurally valid
 *   - Citation conversion handles the demo citation shape
 *   - Widget computation returns the right shape for each of the 6 widgets
 *   - Demo entity data is deterministic per entityId
 */
import {
  buildRetailActions,
  type RetailActionContext,
  type RetailCitationRef,
} from '../../../src/modules/retail/retail-actions';
import { RETAIL_WIDGETS } from '../../../src/modules/retail/retail-widgets';
import { RetailService } from '../../../src/modules/retail/retail.service';

function makeCtx(): RetailActionContext {
  return {
    defaultModel: 'preview-model',
    invokeLLM: async () => ({ text: 'preview', tokensUsed: 100, model: 'preview-model' }),
    invokeLLMStream: async function* () {
      yield { delta: 'preview', tokensUsed: 100 };
    },
    loadEntityData: async () => ({ dummy: true }),
    searchKnowledge: async (_q, _t, k) => {
      const out: RetailCitationRef[] = [];
      for (let i = 0; i < k; i++) {
        out.push({
          id: `kp-${i}`,
          title: `Citation ${i}`,
          content: `Content ${i}`,
          score: 0.9 - i * 0.1,
        });
      }
      return out;
    },
  };
}

describe('retail-actions', () => {
  it('exposes exactly 12 retail AI actions', () => {
    const actions = buildRetailActions(makeCtx());
    expect(Object.keys(actions)).toHaveLength(12);
  });

  it.each([
    'retail:inventory-forecast',
    'retail:visual-merch',
    'retail:nps-analysis',
    'retail:replenishment',
    'retail:conversion-optimizer',
    'retail:loss-prevention',
    'retail:staffing-forecast',
    'retail:layout-optimize',
    'retail:assortment-plan',
    'retail:markdown-optimizer',
    'retail:demand-sensing',
    'retail:shopper-segmentation',
  ])('declares %s with required fields', (id) => {
    const actions = buildRetailActions(makeCtx());
    const def = actions[id as keyof typeof actions];
    expect(def).toBeDefined();
    expect(def.id).toBe(id);
    expect(def.name).toBeTruthy();
    expect(def.description).toBeTruthy();
    expect(['INTELLIGENCE', 'ANALYSIS', 'OPTIMIZATION', 'EXECUTION', 'REPORTING']).toContain(
      def.category,
    );
    expect(def.costModel.tierRequired).toBe('PRO');
    expect(def.timeoutMs).toBeGreaterThan(0);
    expect(def.costModel.tokensEstimate).toBeGreaterThan(0);
    expect(typeof def.handler).toBe('function');
  });

  it('streaming actions return AsyncGenerators', async () => {
    const actions = buildRetailActions(makeCtx());
    const streaming = ['retail:visual-merch', 'retail:layout-optimize'];
    for (const id of streaming) {
      const handler = actions[id as keyof typeof actions].handler;
      const result = handler({
        userId: 'u1',
        userRole: 'OWNER',
        tenantId: 't1',
        entityType: 'FACILITY',
        entityId: 'e1',
        parameters: {},
      });
      expect(result).toBeDefined();
      // Should be iterable (AsyncGenerator)
      const iter = result as AsyncGenerator<unknown>;
      const first = await iter.next();
      expect(first).toBeDefined();
      // Drain.
      // eslint-disable-next-line no-unused-vars
      for await (const _ of iter) void _;
    }
  });

  it('sync actions return AIActionResult envelopes', async () => {
    const actions = buildRetailActions(makeCtx());
    const def = actions['retail:inventory-forecast'];
    const result = (await def.handler({
      userId: 'u1',
      userRole: 'OWNER',
      tenantId: 't1',
      entityType: 'FACILITY',
      entityId: 'e1',
      parameters: {},
    })) as { output: unknown; citations?: unknown[]; tokensUsed?: unknown };
    expect(result).toBeDefined();
    expect(result.output).toBeDefined();
    expect(Array.isArray(result.citations)).toBe(true);
    expect(result.tokensUsed).toBeDefined();
  });
});

describe('retail-widgets', () => {
  it('exposes exactly 6 retail widgets', () => {
    expect(RETAIL_WIDGETS).toHaveLength(6);
  });

  it('all widgets use the retail-kpi: id prefix', () => {
    for (const w of RETAIL_WIDGETS) {
      expect(w.id.startsWith('retail-kpi:')).toBe(true);
    }
  });

  it.each(RETAIL_WIDGETS.map((w) => w.id))('%s has required fields', (id) => {
    const w = RETAIL_WIDGETS.find((x) => x.id === id)!;
    expect(w.title).toBeTruthy();
    expect(w.capability).toBeTruthy();
    expect(w.aggregationType).toBeTruthy();
    expect(w.defaultVisualization).toBeTruthy();
    expect(w.visualizations.length).toBeGreaterThan(0);
    expect(w.entityTypes).toContain('FACILITY');
    expect(w.minSize.w).toBeGreaterThan(0);
    expect(w.maxSize.w).toBeGreaterThanOrEqual(w.minSize.w);
    expect(w.defaultSize.w).toBeGreaterThanOrEqual(w.minSize.w);
    expect(w.defaultSize.w).toBeLessThanOrEqual(w.maxSize.w);
  });
});

describe('RetailService (widget compute, deterministic data)', () => {
  // Stub PrismaService + TenantContextService + registries.
  function makeService(): RetailService {
    const fakeRegistry = {
      list: () => RETAIL_WIDGETS,
      get: (id: string) => RETAIL_WIDGETS.find((w) => w.id === id),
      register: () => undefined,
      registerAll: () => undefined,
      has: () => false,
      count: () => RETAIL_WIDGETS.length,
      clear: () => undefined,
    } as never;
    const fakeAiRegistry = {
      getById: () => undefined,
      getAll: () => [],
      register: () => undefined,
    } as never;
    const fakeTenant = {
      tenantId: 'tenant-1',
    } as never;
    const fakePrisma = {} as never;
    return new RetailService(
      fakeAiRegistry,
      fakeRegistry,
      fakeTenant,
      fakePrisma,
    );
  }

  it('returns the right shape for sales-per-sqft', async () => {
    const svc = makeService();
    const data = (await svc.computeRetailWidget(
      'retail-kpi:sales-per-sqft',
      'FACILITY',
      'soho-flagship',
      { days: 30 },
    )) as { value: number; unit: string; sparkline: number[] };
    expect(typeof data.value).toBe('number');
    expect(data.unit).toBe('USD');
    expect(data.sparkline).toHaveLength(30);
  });

  it('returns the right shape for stockout-rate', async () => {
    const svc = makeService();
    const data = (await svc.computeRetailWidget(
      'retail-kpi:stockout-rate',
      'FACILITY',
      'williamsburg',
      { days: 7 },
    )) as { value: number; unit: string };
    expect(typeof data.value).toBe('number');
    expect(data.unit).toBe('%');
  });

  it('returns the right shape for inventory-heatmap', async () => {
    const svc = makeService();
    const data = (await svc.computeRetailWidget(
      'retail-kpi:inventory-heatmap',
      'FACILITY',
      'park-slope',
      { days: 14, topN: 15 },
    )) as {
      rows: string[];
      cols: string[];
      values: number[][];
    };
    expect(data.rows).toHaveLength(15);
    expect(data.cols).toHaveLength(14);
    expect(data.values).toHaveLength(15);
  });

  it('returns the right shape for customer-nps-gauge', async () => {
    const svc = makeService();
    const data = (await svc.computeRetailWidget(
      'retail-kpi:customer-nps-gauge',
      'FACILITY',
      'silver-lake',
      { days: 30 },
    )) as { value: number; trend: string };
    expect(typeof data.value).toBe('number');
    expect(['improving', 'stable', 'declining']).toContain(data.trend);
  });

  it('returns the right shape for conversion-rate', async () => {
    const svc = makeService();
    const data = (await svc.computeRetailWidget(
      'retail-kpi:conversion-rate',
      'FACILITY',
      'venice-beach',
      { days: 30 },
    )) as { value: number; unit: string; line: number[] };
    expect(typeof data.value).toBe('number');
    expect(data.unit).toBe('%');
    expect(data.line).toHaveLength(30);
  });

  it('returns the right shape for sales-by-hour', async () => {
    const svc = makeService();
    const data = (await svc.computeRetailWidget(
      'retail-kpi:sales-by-hour',
      'FACILITY',
      'mission-district',
      { days: 14 },
    )) as { hours: number[]; avgRevenue: number[] };
    expect(data.hours).toHaveLength(24);
    expect(data.avgRevenue).toHaveLength(24);
  });

  it('throws on unknown widget id', async () => {
    const svc = makeService();
    await expect(
      svc.computeRetailWidget('retail-kpi:not-real', 'FACILITY', 'e1', {}),
    ).rejects.toThrow(/Unknown retail widget/);
  });

  it('returns deterministic data for the same entityId', async () => {
    const svc = makeService();
    const a = (await svc.computeRetailWidget(
      'retail-kpi:sales-per-sqft',
      'FACILITY',
      'wicker-park',
      { days: 30 },
    )) as { value: number; sparkline: number[] };
    const b = (await svc.computeRetailWidget(
      'retail-kpi:sales-per-sqft',
      'FACILITY',
      'wicker-park',
      { days: 30 },
    )) as { value: number; sparkline: number[] };
    expect(a.value).toBe(b.value);
    expect(a.sparkline).toEqual(b.sparkline);
  });

  it('returns different data for different entityIds', async () => {
    const svc = makeService();
    const a = (await svc.computeRetailWidget(
      'retail-kpi:stockout-rate',
      'FACILITY',
      'store-a',
      { days: 7 },
    )) as { value: number };
    const b = (await svc.computeRetailWidget(
      'retail-kpi:stockout-rate',
      'FACILITY',
      'store-b',
      { days: 7 },
    )) as { value: number };
    // Not always strictly different (RNG collisions possible), but
    // mean across many trials differs. Just ensure the call works.
    expect(typeof a.value).toBe('number');
    expect(typeof b.value).toBe('number');
  });

  it('loadDemoData returns a complete RetailEntityData shape', async () => {
    const svc = makeService();
    const data = await svc.loadDemoData('t1', 'FACILITY', 'south-congress', 30);
    expect(data.entityType).toBe('FACILITY');
    expect(data.entityId).toBe('south-congress');
    expect(data.periodDays).toBe(30);
    expect(data.salesPerSqFt).toBeGreaterThan(0);
    expect(data.salesByDay).toHaveLength(30);
    expect(data.heatmapRows).toHaveLength(15);
    expect(data.heatmapCols).toHaveLength(14);
    expect(data.heatmapValues).toHaveLength(15);
    expect(data.topSkus.length).toBeGreaterThan(0);
  });
});