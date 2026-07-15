/**
 * Cloud Control Plane — engines (Phase 11). Region/cluster registry, tenant
 * placement (deterministic routing), failover coordination, replication
 * tracking, global health aggregation. Models cloud topology — actual multi-
 * region infrastructure (K8s, DNS, load balancers) is cloud operations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  ClusterView, FailoverResult, GlobalHealth, ICloudPlatform, RegionView,
  RoutingDecision, TenantPlacementView,
} from '../contracts/cloud-platform.interface';

@Injectable()
export class CloudPlatform implements ICloudPlatform {
  private readonly l = new Logger(CloudPlatform.name);
  constructor(private readonly prisma: PrismaService) {}

  async registerRegion(tenantId: string, name: string, endpoint: string): Promise<RegionView> {
    const r = await this.prisma.cloudRegion.create({ data: { tenantId, name, endpoint } as Prisma.CloudRegionUncheckedCreateInput });
    return { id: r.id, name: r.name, status: r.status as any, endpoint: r.endpoint, clusterCount: 0 };
  }
  async listRegions(tenantId: string): Promise<RegionView[]> {
    return (await (this.prisma.cloudRegion.findMany as any)({ where: { tenantId }, include: { _count: { select: { clusters: true } } } })).map((r: any) => ({
      id: r.id, name: r.name, status: r.status as any, endpoint: r.endpoint, clusterCount: r._count?.clusters ?? 0,
    }));
  }
  /**
   * Audit-remediation: registerCluster previously took only regionId and
   * wrote a cluster row referencing it. A Tenant B JWT could submit a
   * regionId belonging to Tenant A and the cluster write would go
   * through — cross-tenant topology injection. Fix: the service now
   * requires a tenantId parameter and refuses to write when the
   * regionId does not belong to that tenant.
   */
  async registerCluster(tenantId: string, regionId: string, name: string, endpoint?: string): Promise<ClusterView> {
    const region = await this.prisma.cloudRegion.findFirst({
      where: { id: regionId, tenantId },
    });
    if (!region) throw new Error('region not found for tenant');
    const c = await this.prisma.cloudCluster.create({
      data: { regionId, name, endpoint: endpoint ?? null } as Prisma.CloudClusterUncheckedCreateInput,
    });
    return { id: c.id, regionName: region.name, name: c.name, healthy: c.healthy, endpoint: c.endpoint };
  }
  async place(tenantId: string, primaryRegion: string, backupRegion?: string, residencyPolicy?: string): Promise<TenantPlacementView> {
    const row = await this.prisma.tenantPlacement.upsert({
      where: { tenantId },
      create: { tenantId, primaryRegion, backupRegion: backupRegion ?? null, residencyPolicy: residencyPolicy ?? null } as Prisma.TenantPlacementUncheckedCreateInput,
      update: { primaryRegion, backupRegion: backupRegion ?? null, residencyPolicy: residencyPolicy ?? null } as Prisma.TenantPlacementUncheckedUpdateInput,
    });
    return { tenantId: row.tenantId, primaryRegion: row.primaryRegion, backupRegion: row.backupRegion, residencyPolicy: row.residencyPolicy, replicationEnabled: row.replicationEnabled, failoverStatus: row.failoverStatus };
  }
  async getPlacement(tenantId: string): Promise<TenantPlacementView | null> {
    const row = await this.prisma.tenantPlacement.findUnique({ where: { tenantId } });
    if (!row) return null;
    return { tenantId: row.tenantId, primaryRegion: row.primaryRegion, backupRegion: row.backupRegion, residencyPolicy: row.residencyPolicy, replicationEnabled: row.replicationEnabled, failoverStatus: row.failoverStatus };
  }

  /** Deterministic routing: prefer primary if active, else fallback region if active, else fail. */
  async route(tenantId: string): Promise<RoutingDecision> {
    const placement = await this.getPlacement(tenantId);
    if (!placement) return { region: 'unknown', endpoint: '', reason: 'no placement configured', healthy: false };
    const check = async (regionName: string) => {
      const r = await this.prisma.cloudRegion.findFirst({ where: { tenantId, name: regionName, status: 'ACTIVE' } });
      return r ? { region: r.name, endpoint: r.endpoint, healthy: true } : null;
    };
    const primary = await check(placement.primaryRegion);
    if (primary) return { ...primary, reason: 'primary-region-active' };
    if (placement.backupRegion) {
      const backup = await check(placement.backupRegion);
      if (backup) return { ...backup, reason: 'primary-unavailable-fallback' };
    }
    return { region: placement.primaryRegion, endpoint: '', reason: 'no-healthy-region', healthy: false };
  }

  /**
   * Simulate a failover — marks target region standby. Actual DNS/K8s
   * failover is cloud infrastructure.
   *
   * Audit-remediation: previously the service accepted any
   * `targetRegion` string. A tenant could specify a region that does
   * not belong to them, or a non-ACTIVE region, and the upsert would
   * persist the bad value — breaking subsequent `route()` calls.
   * Fix: validate targetRegion against the tenant's ACTIVE regions
   * before any mutation.
   */
  async failover(tenantId: string, targetRegion: string): Promise<FailoverResult> {
    const start = Date.now();
    const placement = await this.getPlacement(tenantId);
    if (!placement) return { success: false, fromRegion: 'unknown', toRegion: targetRegion, reason: 'no placement', durationMs: 0 };

    // Audit-remediation: validate that targetRegion is an ACTIVE region
    // registered to this tenant, otherwise refuse.
    const target = await this.prisma.cloudRegion.findFirst({
      where: { tenantId, name: targetRegion, status: 'ACTIVE' },
    });
    if (!target) {
      return {
        success: false,
        fromRegion: placement.primaryRegion,
        toRegion: targetRegion,
        reason: 'target region not found or not ACTIVE for this tenant',
        durationMs: Date.now() - start,
      };
    }

    // Update placement's failover status
    await this.prisma.tenantPlacement.update({
      where: { tenantId },
      data: { failoverStatus: 'IN_PROGRESS', primaryRegion: targetRegion },
    });
    // Mark old primary's clusters as unhealthy (simulates infrastructure failover).
    const oldRegion = await this.prisma.cloudRegion.findFirst({ where: { tenantId, name: placement.primaryRegion } });
    if (oldRegion) {
      await this.prisma.cloudCluster.updateMany({ where: { regionId: oldRegion.id }, data: { healthy: false } });
    }
    await this.prisma.tenantPlacement.update({ where: { tenantId }, data: { failoverStatus: 'ACTIVE' } });
    return { success: true, fromRegion: placement.primaryRegion, toRegion: targetRegion, reason: 'failover-completed', durationMs: Date.now() - start };
  }

  async globalHealth(tenantId: string): Promise<GlobalHealth> {
    const regions = await (this.prisma.cloudRegion.findMany as any)({ where: { tenantId }, include: { _count: { select: { clusters: true } } } }) as any[];
    const active = regions.filter((r) => r.status === 'ACTIVE').length;
    const failoverActive = (await this.prisma.tenantPlacement.count({ where: { tenantId, failoverStatus: 'ACTIVE' } })) > 0;
    const overall: GlobalHealth['overall'] = regions.length === 0 ? 'FAIR' : active >= regions.length ? 'GOOD' : 'FAIR';
    return {
      overall,
      regions: regions.map((r) => ({ name: r.name, status: r.status as any, clusterCount: (r as any)._count?.clusters ?? 0 })),
      failoverActive,
    };
  }
}
