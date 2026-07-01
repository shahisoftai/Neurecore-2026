import { AnalyticsService } from '../../src/modules/analytics/services/analytics.service';
import { PrismaFeatureStore } from '../../src/modules/analytics/services/featureStore.prisma';
import { HttpModelRunner } from '../../src/modules/analytics/services/modelRunner.http';
import { TenantContextService } from '../../src/common/context/tenant-context.service';

/**
 * Unit tests for AnalyticsService.
 *
 * Phase 1E migration: services now read `tenantContext.tenantId` instead
 * of receiving it as a method parameter. The signature change means the
 * tests now pass `tenantId` via `TenantContextService.run(...)` scope
 * instead of as a method argument.
 */

function buildMocks() {
  const prisma: any = {
    analyticsModel: {
      findMany: jest
        .fn()
        .mockResolvedValue([
          { id: 'model-1', name: 'demo', version: 'v1', createdAt: new Date() },
        ]),
    },
  };

  const featureStore: Partial<PrismaFeatureStore> = {
    save: jest.fn().mockResolvedValue(undefined),
    getLatest: jest.fn().mockResolvedValue({
      features: { a: 1 },
      timestamp: new Date().toISOString(),
    }),
    list: jest
      .fn()
      .mockResolvedValue([
        { features: { a: 1 }, timestamp: new Date().toISOString() },
      ]),
  };

  const modelRunner: Partial<HttpModelRunner> = {
    runModel: jest.fn().mockResolvedValue({ modelId: 'model-1', score: 0.75 }),
    forecast: jest.fn().mockResolvedValue({ forecast: [] }),
    detectAnomalies: jest
      .fn()
      .mockResolvedValue({ labels: [0, 1], scores: [-0.1, 0.3] }),
    embed: jest.fn().mockResolvedValue({ vectors: [[0.1, 0.2]] }),
  };

  const tenantContext = new TenantContextService();
  const svc = new AnalyticsService(
    prisma,
    featureStore as PrismaFeatureStore,
    modelRunner as HttpModelRunner,
    tenantContext,
  );

  return { svc, prisma, featureStore, modelRunner, tenantContext };
}

/**
 * Wrap an async call in a tenant scope so `tenantContext.tenantId` works.
 */
async function asTenant<T>(
  tenantContext: TenantContextService,
  tenantId: string,
  fn: () => Promise<T>,
): Promise<T> {
  return tenantContext.run({ tenantId }, fn);
}

describe('AnalyticsService', () => {
  it('score() saves features and calls model runner', async () => {
    const { svc, featureStore, modelRunner, tenantContext } = buildMocks();
    const result = await asTenant(tenantContext, 'tenant-1', () =>
      svc.score({ revenue: 200, users: 50 }),
    );
    expect(featureStore.save).toHaveBeenCalledWith({ revenue: 200, users: 50 });
    expect(modelRunner.runModel).toHaveBeenCalledWith('model-1', {
      revenue: 200,
      users: 50,
    });
    expect(result).toMatchObject({ score: 0.75 });
  });

  it('forecast() delegates to model runner', async () => {
    const { svc, modelRunner, tenantContext } = buildMocks();
    const result = await asTenant(tenantContext, 'tenant-1', () =>
      svc.forecast(14),
    );
    expect(modelRunner.forecast).toHaveBeenCalledWith(14);
    expect(result).toMatchObject({ tenantId: 'tenant-1', periods: 14 });
  });

  it('detectAnomalies() returns labels and scores', async () => {
    const { svc, modelRunner, tenantContext } = buildMocks();
    const result = await asTenant(tenantContext, 'tenant-1', () =>
      svc.detectAnomalies([
        [1, 2, 3, 4],
        [5, 6, 7, 8],
      ]),
    );
    expect(modelRunner.detectAnomalies).toHaveBeenCalledWith([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    expect(result).toMatchObject({ labels: [0, 1] });
  });

  it('embed() returns vectors and count', async () => {
    const { svc, modelRunner, tenantContext } = buildMocks();
    const result = await asTenant(tenantContext, 'tenant-1', () =>
      svc.embed(['hello world']),
    );
    expect(modelRunner.embed).toHaveBeenCalledWith(['hello world']);
    expect(result).toMatchObject({ count: 1 });
  });

  it('getReport() returns model list and latest features', async () => {
    const { svc, tenantContext } = buildMocks();
    const report = await asTenant(tenantContext, 'tenant-1', () =>
      svc.getReport(),
    );
    expect(report).toMatchObject({ tenantId: 'tenant-1' });
    expect(Array.isArray(report.models)).toBe(true);
  });
});
