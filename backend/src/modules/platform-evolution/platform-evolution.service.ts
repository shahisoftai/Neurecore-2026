/**
 * Platform Evolution — contracts + engines (Phase 14).
 * Technology Radar (Emerging/Trial/Adopt/Hold/Retire), Model Registry,
 * Benchmarking, Experimentation, Feature Lifecycle, Capability Versioning,
 * Migration Planning, Future Readiness. All governed — produce recommendations
 * and plans, NEVER auto-execute, NEVER self-modify.
 */
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';

export interface TechRadarView { id: string; name: string; category: string; maturity: string; description: string | null; recommendation: string | null }
export interface BenchmarkView { id: string; modelName: string; provider: string; task: string; score: number; createdAt: string }
export interface ExperimentView { id: string; name: string; status: string; affectProduction: boolean }
export interface FeatureView { id: string; name: string; state: string; version: number }
export interface CapabilityVersionView { id: string; domain: string; version: number; backwardCompatible: boolean }
export interface MigrationPlanView { id: string; name: string; targetType: string; steps: string[]; riskLevel: string; autoApply: boolean }

export const PLATFORM_EVOLUTION = Symbol('PLATFORM_EVOLUTION');
export interface IPlatformEvolution {
  // Technology Radar
  addRadarEntry(tenantId: string, name: string, category: string, maturity?: string): Promise<TechRadarView>;
  listRadar(tenantId: string): Promise<TechRadarView[]>;
  // Benchmarks
  recordBenchmark(tenantId: string, modelName: string, provider: string, task: string, score: number): Promise<BenchmarkView>;
  listBenchmarks(tenantId: string, modelName?: string): Promise<BenchmarkView[]>;
  // Experiments
  createExperiment(tenantId: string, name: string, description?: string): Promise<ExperimentView>;
  completeExperiment(tenantId: string, id: string, results: Record<string,unknown>): Promise<ExperimentView>;
  listExperiments(tenantId: string): Promise<ExperimentView[]>;
  // Feature Lifecycle
  registerFeature(tenantId: string, name: string, state?: string): Promise<FeatureView>;
  advanceFeature(tenantId: string, id: string, state: string): Promise<FeatureView>;
  listFeatures(tenantId: string): Promise<FeatureView[]>;
  // Capability Versions
  versionCapability(tenantId: string, domain: string, changes?: string[], backwardCompatible?: boolean): Promise<CapabilityVersionView>;
  listCapabilityVersions(tenantId: string): Promise<CapabilityVersionView[]>;
  // Migration Plans
  createMigrationPlan(tenantId: string, name: string, targetType: string, steps?: string[], riskLevel?: string): Promise<MigrationPlanView>;
  listMigrationPlans(tenantId: string): Promise<MigrationPlanView[]>;
  // Dashboard
  dashboard(tenantId: string): Promise<{ radarEntries: number; benchmarks: number; experiments: number; features: number; capabilityVersions: number; migrationPlans: number }>;
}

@Injectable()
export class PlatformEvolution implements IPlatformEvolution {
  constructor(private readonly prisma: PrismaService) {}

  async addRadarEntry(tenantId: string, name: string, category: string, maturity = 'TRIAL') {
    const r = await this.prisma.technologyRadarEntry.upsert({ where: { tenantId_name: { tenantId, name } }, create: { tenantId, name, category, maturity: maturity as any }, update: { category, maturity: maturity as any } });
    return { id: r.id, name: r.name, category: r.category, maturity: r.maturity, description: r.description, recommendation: r.recommendation };
  }
  async listRadar(tenantId: string) {
    return (await this.prisma.technologyRadarEntry.findMany({ where: { tenantId } })).map((r) => ({ id: r.id, name: r.name, category: r.category, maturity: r.maturity, description: r.description, recommendation: r.recommendation }));
  }

  async recordBenchmark(tenantId: string, modelName: string, provider: string, task: string, score: number) {
    const r = await this.prisma.benchmarkRecord.create({ data: { tenantId, modelName, provider, task, score } });
    return { id: r.id, modelName: r.modelName, provider: r.provider, task: r.task, score: r.score, createdAt: r.createdAt.toISOString() };
  }
  async listBenchmarks(tenantId: string, modelName?: string) {
    return (await this.prisma.benchmarkRecord.findMany({ where: { tenantId, ...(modelName ? { modelName } : {}) }, orderBy: { createdAt: 'desc' }, take: 50 })).map((r) => ({ id: r.id, modelName: r.modelName, provider: r.provider, task: r.task, score: r.score, createdAt: r.createdAt.toISOString() }));
  }

  async createExperiment(tenantId: string, name: string, description?: string) {
    const r = await this.prisma.experiment.create({ data: { tenantId, name, description: description ?? null } });
    return { id: r.id, name: r.name, status: r.status, affectProduction: r.affectProduction };
  }
  async completeExperiment(tenantId: string, id: string, results: Record<string, unknown>) {
    // Audit-remediation: pre-fix code used update with `where: { id }` —
    // missing tenantId in the WHERE. A Tenant B JWT could complete Tenant
    // A's experiment by guessing the cuid. Fix: read+updateMany under
    // (id, tenantId); refuse on count=0 or missing findFirst.
    const owned = await this.prisma.experiment.findFirst({ where: { id, tenantId } });
    if (!owned) throw new Error('experiment not found for tenant');
    const u = await this.prisma.experiment.updateMany({
      where: { id, tenantId },
      data: { status: 'COMPLETED' as any, resultsJson: results as Prisma.InputJsonValue, completedAt: new Date() },
    });
    if (u.count === 0) throw new Error('experiment not found for tenant');
    const after = await this.prisma.experiment.findFirst({ where: { id, tenantId } });
    return { id: after!.id, name: after!.name, status: after!.status, affectProduction: after!.affectProduction };
  }
  async listExperiments(tenantId: string) {
    return (await this.prisma.experiment.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 })).map((r) => ({ id: r.id, name: r.name, status: r.status, affectProduction: r.affectProduction }));
  }

  async registerFeature(tenantId: string, name: string, state = 'PROPOSAL') {
    const r = await this.prisma.featureLifecycle.create({ data: { tenantId, name, state: state as any } });
    return { id: r.id, name: r.name, state: r.state, version: r.version };
  }
  async advanceFeature(tenantId: string, id: string, state: string) {
    // Audit-remediation: pre-fix code used update with `where: { id }` —
    // missing tenantId in the WHERE. A Tenant B JWT could advance Tenant
    // A's feature through its lifecycle by guessing the cuid. Fix:
    // read+updateMany under (id, tenantId); refuse on count=0 or
    // missing findFirst.
    const owned = await this.prisma.featureLifecycle.findFirst({ where: { id, tenantId } });
    if (!owned) throw new Error('feature not found for tenant');
    const u = await this.prisma.featureLifecycle.updateMany({
      where: { id, tenantId },
      data: { state: state as any },
    });
    if (u.count === 0) throw new Error('feature not found for tenant');
    const after = await this.prisma.featureLifecycle.findFirst({ where: { id, tenantId } });
    return { id: after!.id, name: after!.name, state: after!.state, version: after!.version };
  }
  async listFeatures(tenantId: string) {
    return (await this.prisma.featureLifecycle.findMany({ where: { tenantId }, orderBy: { updatedAt: 'desc' }, take: 50 })).map((r) => ({ id: r.id, name: r.name, state: r.state, version: r.version }));
  }

  async versionCapability(tenantId: string, domain: string, changes: string[] = [], backwardCompatible = true) {
    const latest = await this.prisma.capabilityVersion.findFirst({ where: { tenantId, domain: domain as any }, orderBy: { version: 'desc' } });
    const r = await this.prisma.capabilityVersion.create({ data: { tenantId, domain: domain as any, version: (latest?.version ?? 0) + 1, changes, backwardCompatible } });
    return { id: r.id, domain: r.domain, version: r.version, backwardCompatible: r.backwardCompatible };
  }
  async listCapabilityVersions(tenantId: string) {
    return (await this.prisma.capabilityVersion.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 })).map((r) => ({ id: r.id, domain: r.domain, version: r.version, backwardCompatible: r.backwardCompatible }));
  }

  async createMigrationPlan(tenantId: string, name: string, targetType: string, steps: string[] = [], riskLevel = 'LOW') {
    const r = await this.prisma.migrationPlan.create({ data: { tenantId, name, targetType, stepsJson: steps, riskLevel } });
    return { id: r.id, name: r.name, targetType: r.targetType, steps: (r.stepsJson ?? []) as string[], riskLevel: r.riskLevel, autoApply: r.autoApply };
  }
  async listMigrationPlans(tenantId: string) {
    return (await this.prisma.migrationPlan.findMany({ where: { tenantId }, orderBy: { createdAt: 'desc' }, take: 50 })).map((r) => ({ id: r.id, name: r.name, targetType: r.targetType, steps: (r.stepsJson ?? []) as string[], riskLevel: r.riskLevel, autoApply: r.autoApply }));
  }

  async dashboard(tenantId: string) {
    const [radarEntries, benchmarks, experiments, features, capabilityVersions, migrationPlans] = await Promise.all([
      this.prisma.technologyRadarEntry.count({ where: { tenantId } }),
      this.prisma.benchmarkRecord.count({ where: { tenantId } }),
      this.prisma.experiment.count({ where: { tenantId } }),
      this.prisma.featureLifecycle.count({ where: { tenantId } }),
      this.prisma.capabilityVersion.count({ where: { tenantId } }),
      this.prisma.migrationPlan.count({ where: { tenantId } }),
    ]);
    return { radarEntries, benchmarks, experiments, features, capabilityVersions, migrationPlans };
  }
}
