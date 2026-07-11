import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  ACTIVITY_SERVICE,
  type IActivityService,
} from '../interfaces/IActivityService';
import type { EntityType, RelationshipType } from '@prisma/client';
import type { ParticipantType } from '@prisma/client';

interface ThresholdConfig {
  warnAfterMs: number;
  escalateAfterMs: number;
  maxLevels: number;
}

@Injectable()
export class EscalationService implements OnModuleInit {
  private readonly logger = new Logger(EscalationService.name);
  private readonly INTERVAL_MS = 60_000;
  private timer: NodeJS.Timeout | null = null;

  private readonly THRESHOLDS: Record<string, ThresholdConfig> = {
    approval: {
      warnAfterMs: 4 * 3600 * 1000,
      escalateAfterMs: 8 * 3600 * 1000,
      maxLevels: 3,
    },
    risk: {
      warnAfterMs: 1 * 3600 * 1000,
      escalateAfterMs: 4 * 3600 * 1000,
      maxLevels: 2,
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACTIVITY_SERVICE)
    private readonly activityService: IActivityService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        this.logger.warn(`escalation tick failed: ${String(err)}`),
      );
    }, this.INTERVAL_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const categories = ['approval:requested', 'risk:detected'];
    const now = Date.now();
    for (const type of categories) {
      const threshold =
        this.THRESHOLDS[type === 'approval:requested' ? 'approval' : 'risk'];
      const stale = await this.prisma.activityEvent.findMany({
        where: {
          type,
          createdAt: { lt: new Date(now - threshold.warnAfterMs) },
        },
      });
      for (const activity of stale) {
        const level =
          ((activity.payload as Record<string, unknown>)?.escalationLevel as
            | number
            | undefined) ?? 0;
        if (level >= threshold.maxLevels) continue;
        if (!activity.targetParticipantId || !activity.targetParticipantType)
          continue;
        const next = await this.findNextApprover(
          activity.targetParticipantId,
          activity.targetParticipantType,
          activity.tenantId,
        );
        if (!next) continue;
        await this.activityService.record({
          tenantId: activity.tenantId,
          actorType: 'SYSTEM',
          actorId: 'escalation',
          type: `${type}.escalated`,
          title: `Escalated: ${activity.title}`,
          threadId: activity.threadId ?? undefined,
          sourceEventId: `escalation:${activity.id}:${level + 1}`,
          visibility: 'direct',
          targetParticipantType: next.type as ParticipantType,
          targetParticipantId: next.id,
          payload: {
            originalEventId: activity.id,
            escalationLevel: level + 1,
          },
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        });
      }
    }
  }

  private async findNextApprover(
    participantId: string,
    participantType: string,
    tenantId: string,
  ): Promise<{ id: string; type: string } | null> {
    const report = await this.prisma.entityRelationship.findFirst({
      where: {
        tenantId,
        fromType: participantType as EntityType,
        fromId: participantId,
        type: 'REPORTS_TO' as RelationshipType,
      },
    });
    if (report) return { id: report.toId, type: report.toType };
    return null;
  }
}
