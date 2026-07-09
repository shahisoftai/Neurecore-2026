/**
 * MissionFeedService — Phase 3, Task 3.11 (per `EAOS-implementation-plan.md`
 * EAOS-1 + `EAOS-api-contract.md` §8.13).
 *
 * Lists tenant-wide AI-prioritized items needing user attention. Items
 * are dismissable per-user. Phase 5 wires AI prioritization (currently
 * items are seeded manually via the create endpoint).
 *
 * Phase 2 (Enterprise Communication): write-through adapter — every
 * create() also records an ActivityEvent so the unified feed works
 * without polling. ActivityService is injected via @Optional to
 * preserve backward compatibility with existing tests.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IActivityService } from '../../hermes/interfaces/IActivityService';
import type { CreateMissionFeedItemDto } from '../dto/mission-feed.dto';
import type { Prisma } from '@prisma/client';

@Injectable()
export class MissionFeedService {
  private readonly logger = new Logger(MissionFeedService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly activityService?: IActivityService,
  ) {}

  async list(options: {
    userId: string;
    tenantId: string | null;
    page?: number;
    limit?: number;
    priority?: string;
  }) {
    if (!options.tenantId) {
      throw new Error('Tenant ID is required to list mission feed items');
    }
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(100, Math.max(1, options.limit ?? 20));
    const tenantId = options.tenantId;

    const where: Prisma.MissionFeedItemWhereInput = {
      tenantId,
      dismissedAt: null,
      OR: [{ userId: null }, { userId: options.userId }],
      ...(options.priority ? { priority: options.priority as never } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.missionFeedItem.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { detectedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.missionFeedItem.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  async dismiss(itemId: string, userId: string, tenantId: string | null) {
    if (!tenantId) {
      throw new Error('Tenant ID is required to dismiss mission feed items');
    }
    // Idempotent: set dismissedAt if not already.
    await this.prisma.missionFeedItem.updateMany({
      where: {
        id: itemId,
        tenantId,
        OR: [{ userId: null }, { userId }],
        dismissedAt: null,
      },
      data: { dismissedAt: new Date() },
    });
    return { dismissed: true };
  }

  async create(dto: CreateMissionFeedItemDto, tenantId: string | null) {
    if (!tenantId) {
      throw new Error('Tenant ID is required to create mission feed items');
    }

    // Idempotency on sourceEventId within a tenant.
    if (dto.sourceEventId) {
      const existing = await this.prisma.missionFeedItem.findFirst({
        where: { tenantId, sourceEventId: dto.sourceEventId },
      });
      if (existing) return existing;
    }

    const item = await this.prisma.missionFeedItem.create({
      data: {
        tenantId,
        category: dto.category,
        priority: dto.priority ?? 'MEDIUM',
        title: dto.title,
        description: dto.description,
        entityType: dto.entityType,
        entityId: dto.entityId,
        actionPayload: (dto.actionPayload ?? {}) as never,
        sourceEventId: dto.sourceEventId,
      },
    });

    // Write-through to canonical ActivityEvent (no polling needed).
    if (this.activityService) {
      this.activityService
        .record({
          tenantId,
          actorType: 'SYSTEM',
          actorId: 'mission-feed',
          type: `mission.${dto.category.toLowerCase()}`,
          title: dto.title,
          description: dto.description ?? undefined,
          entityType: dto.entityType ?? undefined,
          entityId: dto.entityId ?? undefined,
          sourceEventId: item.sourceEventId ?? item.id,
          createdAt: item.createdAt,
        })
        .catch((err) =>
          this.logger.warn(`Activity record failed: ${String(err)}`),
        );
    }

    return item;
  }
}
