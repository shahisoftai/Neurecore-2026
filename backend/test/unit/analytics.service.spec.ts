import { AnalyticsService } from '../../src/modules/analytics/services/analytics.service';
import { PrismaFeatureStore } from '../../src/modules/analytics/services/featureStore.prisma';
import { HttpModelRunner } from '../../src/modules/analytics/services/modelRunner.http';

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

  const svc = new AnalyticsService(
    prisma as any,
    featureStore as any,
    modelRunner as any,
  );

  return { svc, prisma, featureStore, modelRunner };
}

describe('AnalyticsService', () => {
  it('score() saves features with tenantId and calls model runner', async () => {
    const { svc, featureStore, modelRunner } = buildMocks();
    const result = await svc.score('tenant-1', { revenue: 200, users: 50 });
    expect(featureStore.save).toHaveBeenCalledWith('tenant-1', { revenue: 200, users: 50 });
    expect(modelRunner.runModel).toHaveBeenCalledWith('model-1', {
      revenue: 200,
      users: 50,
    });
    expect(result).toMatchObject({ score: 0.75 });
  });

  it('forecast() delegates to model runner with periods', async () => {
    const { svc, modelRunner } = buildMocks();
    const result = await svc.forecast('tenant-1', 14);
    expect(modelRunner.forecast).toHaveBeenCalledWith(14);
    expect(result).toMatchObject({ tenantId: 'tenant-1', periods: 14 });
  });

  it('detectAnomalies() returns labels and scores', async () => {
    const { svc, modelRunner } = buildMocks();
    const result = await svc.detectAnomalies('tenant-1', [
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    expect(modelRunner.detectAnomalies).toHaveBeenCalledWith([
      [1, 2, 3, 4],
      [5, 6, 7, 8],
    ]);
    expect(result).toMatchObject({ labels: [0, 1] });
  });

  it('embed() returns vectors and count', async () => {
    const { svc, modelRunner } = buildMocks();
    const result = await svc.embed('tenant-1', ['hello world']);
    expect(modelRunner.embed).toHaveBeenCalledWith(['hello world']);
    expect(result).toMatchObject({ count: 1 });
  });

  it('getReport() returns model list and latest features', async () => {
    const { svc } = buildMocks();
    const report = await svc.getReport('tenant-1');
    expect(report).toMatchObject({ tenantId: 'tenant-1' });
    expect(Array.isArray(report.models)).toBe(true);
  });
});
