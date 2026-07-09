import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import type { ActivityEvent, ParticipantType, Prisma } from '@prisma/client';
import {
  ACTIVITY_SERVICE,
  type IActivityService,
  type ListActivityOpts,
  type RecordActivityParams,
} from '../interfaces/IActivityService';

const DEFAULT_TTL_DAYS = 90;

@Injectable()
export class ActivityService implements IActivityService {
  private readonly logger = new Logger(ActivityService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async record(params: RecordActivityParams): Promise<ActivityEvent> {
    const visibility = params.visibility ?? 'tenant';
    const expiresAt =
      params.expiresAt ??
      new Date(Date.now() + DEFAULT_TTL_DAYS * 24 * 60 * 60 * 1000);

    const data: Prisma.ActivityEventCreateInput = {
      tenant: { connect: { id: params.tenantId } },
      actorType: params.actorType,
      actorId: params.actorId,
      type: params.type,
      title: params.title,
      description: params.description ?? null,
      contextType: params.contextType ?? null,
      contextId: params.contextId ?? null,
      entityType: params.entityType ?? null,
      entityId: params.entityId ?? null,
      payload: (params.payload ?? {}) as Prisma.InputJsonValue,
      severity: params.severity ?? 'info',
      visibility,
      targetParticipantType: params.targetParticipantType ?? null,
      targetParticipantId: params.targetParticipantId ?? null,
      sourceEventId: params.sourceEventId ?? null,
      expiresAt,
      ...(params.createdAt ? { createdAt: params.createdAt } : {}),
      ...(params.threadId
        ? { thread: { connect: { id: params.threadId } } }
        : {}),
    };

    let event: ActivityEvent;
    try {
      event = await this.prisma.activityEvent.create({ data });
    } catch (err) {
      // Idempotency via sourceEventId — unique constraint violation = dup
      if (
        params.sourceEventId &&
        err instanceof Error &&
        err.message.includes('Unique constraint')
      ) {
        const existing = await this.prisma.activityEvent.findUnique({
          where: { sourceEventId: params.sourceEventId },
        });
        if (existing) return existing;
      }
      throw err;
    }

    this.eventsGateway.emitToTenant(
      params.tenantId,
      'activity:new',
      this.toData(event),
    );
    if (params.threadId) {
      this.eventsGateway.emitToRoom(
        `thread:${params.threadId}`,
        'thread:activity',
        this.toData(event),
      );
    }
    if (visibility === 'direct' && params.targetParticipantId) {
      this.eventsGateway.emitToUser(
        params.targetParticipantId,
        'activity:direct',
        this.toData(event),
      );
    }

    return event;
  }

  async list(
    tenantId: string,
    opts?: ListActivityOpts,
  ): Promise<ActivityEvent[]> {
    const where: Prisma.ActivityEventWhereInput = { tenantId };

    const threadIds: string[] = [];
    if (opts?.userId) {
      const userThreads = await this.prisma.threadParticipant.findMany({
        where: {
          participantType: 'USER',
          participantId: opts.userId,
          isActive: true,
        },
        select: { threadId: true },
      });
      threadIds.push(...userThreads.map((t) => t.threadId));
    }
    if (opts?.agentId) {
      const agentThreads = await this.prisma.threadParticipant.findMany({
        where: {
          participantType: 'AI_AGENT',
          participantId: opts.agentId,
          isActive: true,
        },
        select: { threadId: true },
      });
      threadIds.push(...agentThreads.map((t) => t.threadId));
    }

    const orClauses: Prisma.ActivityEventWhereInput[] = [
      { visibility: 'tenant' },
    ];
    if (threadIds.length > 0) {
      orClauses.push({
        visibility: 'thread',
        threadId: { in: threadIds },
      });
    }
    if (opts?.userId || opts?.agentId) {
      orClauses.push({
        visibility: 'direct',
        OR: [
          ...(opts?.userId
            ? [
                {
                  targetParticipantType: 'USER' as ParticipantType,
                  targetParticipantId: opts.userId,
                },
              ]
            : []),
          ...(opts?.agentId
            ? [
                {
                  targetParticipantType: 'AI_AGENT' as ParticipantType,
                  targetParticipantId: opts.agentId,
                },
              ]
            : []),
        ],
      });
    }
    where.OR = orClauses;

    if (opts?.types?.length) where.type = { in: opts.types };
    if (opts?.severity) where.severity = opts.severity;
    if (opts?.visibility?.length) {
      // Caller can constrain visibility further (must intersect with OR)
      where.OR = orClauses.filter((c) =>
        'visibility' in c && typeof c.visibility === 'string'
          ? opts.visibility!.includes(c.visibility)
          : true,
      );
    }
    if (opts?.before) where.id = { lt: opts.before };
    if (opts?.since) where.id = { gt: opts.since };

    const limit = Math.min(200, Math.max(1, opts?.limit ?? 50));
    return this.prisma.activityEvent.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  private toData(e: ActivityEvent) {
    return {
      id: e.id,
      tenantId: e.tenantId,
      actorType: e.actorType,
      actorId: e.actorId,
      type: e.type,
      title: e.title,
      description: e.description,
      threadId: e.threadId,
      contextType: e.contextType,
      contextId: e.contextId,
      entityType: e.entityType,
      entityId: e.entityId,
      payload: e.payload,
      severity: e.severity,
      visibility: e.visibility,
      targetParticipantType: e.targetParticipantType,
      targetParticipantId: e.targetParticipantId,
      createdAt: e.createdAt,
    };
  }
}

export { ACTIVITY_SERVICE };
