/**
 * InsightsCapability — Phase 3 capability surface for the Insights panel.
 *
 * Returns: KPIs, analytics, reports, trends, benchmarks, exports.
 * Per EAOS-implementation-plan.md §1.5. Phase 4 (Widgets) will provide
 * the rich widget grid; Phase 3 ships the data shape.
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityResolverService } from './entity-resolver.service';
import type { EaosEntityType } from '../dto/entity.dto';

export interface InsightsPanel {
  id: string;
  type: string;
  kpis: Array<{
    name: string;
    value: number | string;
    target: number | string | null;
    trend: 'UP' | 'DOWN' | 'STABLE';
    status: 'ON_TRACK' | 'AT_RISK' | 'OFF_TRACK';
  }>;
  trends: Array<{ metric: string; series: number[] }>;
  reports: Array<{ id: string; title: string; generatedAt: string }>;
}

@Injectable()
export class InsightsCapability {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EntityResolverService,
  ) {}

  async get(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<InsightsPanel> {
    await this.resolver.resolve(type, id, tenantId);

    // Pull computed KPIs from the EntityHealth.signals JSON.
    const health = await this.prisma.entityHealth.findUnique({
      where: {
        tenantId_entityType_entityId: { tenantId, entityType: type, entityId: id },
      },
    });

    const signals = (health?.signals as Record<string, number>) ?? {};
    const kpis: InsightsPanel['kpis'] = Object.entries(signals).map(
      ([name, value]) => ({
        name,
        value,
        target: null,
        trend: 'STABLE' as const,
        status: 'ON_TRACK' as const,
      }),
    );

    return {
      id,
      type,
      kpis,
      trends: [],
      reports: [],
    };
  }
}
