import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MissionFeedService } from '../../mission-feed/services/mission-feed.service';
import type { EntityType, RelationshipType } from '@prisma/client';

@Injectable()
export class RiskDetectionService implements OnModuleInit {
  private readonly logger = new Logger(RiskDetectionService.name);
  private readonly INTERVAL_MS = 300_000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly missionFeed: MissionFeedService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        this.logger.warn(`risk tick failed: ${String(err)}`),
      );
    }, this.INTERVAL_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true },
    });
    for (const t of tenants) {
      const degrading = await this.prisma.entityHealth.findMany({
        where: { tenantId: t.id, severity: 'CRITICAL' },
      });
      for (const health of degrading) {
        const manager = await this.findManager(
          health.entityType,
          health.entityId,
          t.id,
        );
        if (!manager) continue;
        try {
          await this.missionFeed.create(
            {
              category: 'ANOMALY_DETECTED',
              priority: 'HIGH',
              title: `${health.entityType} health degraded`,
              description: `${health.entityId} score dropped to ${health.score}`,
              entityType: health.entityType as never,
              entityId: health.entityId,
              actionPayload: { signals: health.signals, trend: health.trend },
              sourceEventId: `risk:${health.entityType}:${health.entityId}:${health.updatedAt.getTime()}`,
            },
            t.id,
          );
        } catch (err) {
          this.logger.warn(`mission feed create failed: ${String(err)}`);
        }
      }
    }
  }

  private async findManager(
    entityType: string,
    entityId: string,
    tenantId: string,
  ): Promise<string | null> {
    const report = await this.prisma.entityRelationship.findFirst({
      where: {
        tenantId,
        fromType: entityType as EntityType,
        fromId: entityId,
        type: 'REPORTS_TO' as RelationshipType,
      },
    });
    if (!report) return null;
    if (report.toType === ('USER' as EntityType)) return report.toId;
    return null;
  }
}
