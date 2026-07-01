import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaFeatureStore } from './featureStore.prisma';
import { HttpModelRunner } from './modelRunner.http';

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureStore: PrismaFeatureStore,
    private readonly modelRunner: HttpModelRunner,
  ) {}

  async getModels(tenantId: string) {
    return this.prisma.analyticsModel.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async score(tenantId: string, features: Record<string, unknown>): Promise<Record<string, unknown>> {
    await this.featureStore.save(tenantId, features);
    const models = await this.getModels(tenantId);
    const model = models[0];
    if (!model)
      this.logger.warn(`No model for tenant ${tenantId}; using runner default`);
    return this.modelRunner.runModel(model?.id ?? 'default', features);
  }

  async forecast(tenantId: string, periods: number): Promise<Record<string, unknown>> {
    const result = await this.modelRunner.forecast(periods);
    return { tenantId, periods, ...result };
  }

  async detectAnomalies(tenantId: string, vectors: number[][]): Promise<Record<string, unknown>> {
    const result = await this.modelRunner.detectAnomalies(vectors);
    return { tenantId, ...result };
  }

  async embed(tenantId: string, texts: string[]): Promise<Record<string, unknown>> {
    const result = await this.modelRunner.embed(texts);
    return { tenantId, count: texts.length, ...result };
  }

  async getFeatureHistory(tenantId: string, limit = 50) {
    return this.featureStore.list(tenantId, limit);
  }

  async getLatestFeatures(tenantId: string) {
    return this.featureStore.getLatest(tenantId);
  }

  async getReport(tenantId: string) {
    const [models, latest] = await Promise.all([
      this.getModels(tenantId),
      this.featureStore.getLatest(tenantId),
    ]);
    return {
      tenantId,
      models: models.map((m) => ({
        id: m.id,
        name: m.name,
        version: m.version,
      })),
      latestFeatures: latest,
      generatedAt: new Date().toISOString(),
    };
  }
}
