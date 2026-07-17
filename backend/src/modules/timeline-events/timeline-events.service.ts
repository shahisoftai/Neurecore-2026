import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TimelineEventStatus } from '@prisma/client';

/**
 * Status transition matrix (the source of truth).
 * Mirrors the DB trigger; the application layer also validates so we get a
 * clean error message rather than the raw DB exception.
 */
const ALLOWED_TRANSITIONS: Record<TimelineEventStatus, TimelineEventStatus[]> = {
  DRAFT:       ['REPORTED', 'FAILED'],
  REPORTED:    ['VERIFIED', 'INVALIDATED', 'CANCELLED'],
  VERIFIED:    ['ACTIVE', 'INVALIDATED', 'CANCELLED'],
  ACTIVE:      ['RESOLVED', 'INVALIDATED', 'CANCELLED'],
  RESOLVED:    [],
  INVALIDATED: [],
  CANCELLED:   [],
  FAILED:      ['REPORTED'],  // explicit recovery
};

/**
 * TimelineEventsService — Phase 1 (Simulation-5).
 *
 * Persists a real, queryable, first-class event log. Used by:
 * - The simulation framework (Reality Engine, Approval Engine, Auditor Engine, etc.)
 * - Production features (supplier incidents, security events, policy changes)
 *
 * The DB trigger enforces the same transition matrix as a defense-in-depth.
 * This service does the same validation in the application layer so we can
 * return a clean error rather than a raw constraint violation.
 *
 * Exactly-one-actor rule is enforced at the DB level via a CHECK constraint;
 * the application layer does not re-validate it.
 */
@Injectable()
export class TimelineEventsService {
  private readonly logger = new Logger(TimelineEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new timeline event. The caller must supply exactly one of
   * createdByUserId, createdByAgentId, or createdByServiceIdentityId.
   * (DB enforces this; the application passes through.)
   */
  async create(params: {
    tenantId: string;
    projectId?: string;
    simulationId?: string;
    simulationRunId?: string;
    occurredAt?: Date;
    category: any;
    severity: any;
    sourceType: any;
    sourceId?: string;
    title: string;
    description: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
    correlationId?: string;
    traceId?: string;
    causationId?: string;
    parentEventId?: string;
    rootEventId?: string;
    createdByUserId?: string;
    createdByAgentId?: string;
    createdByServiceIdentityId?: string;
    metadata?: any;
  }) {
    const actorCount =
      (params.createdByUserId ? 1 : 0) +
      (params.createdByAgentId ? 1 : 0) +
      (params.createdByServiceIdentityId ? 1 : 0);
    if (actorCount !== 1) {
      throw new BadRequestException({
        code: 'EXACTLY_ONE_ACTOR_REQUIRED',
        message: 'Exactly one of createdByUserId, createdByAgentId, createdByServiceIdentityId must be set.',
      });
    }
    return this.prisma.timelineEvent.create({
      data: {
        tenantId: params.tenantId,
        projectId: params.projectId,
        simulationId: params.simulationId,
        simulationRunId: params.simulationRunId,
        occurredAt: params.occurredAt ?? new Date(),
        category: params.category,
        severity: params.severity,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        title: params.title,
        description: params.description,
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
        correlationId: params.correlationId,
        traceId: params.traceId,
        causationId: params.causationId,
        parentEventId: params.parentEventId,
        rootEventId: params.rootEventId,
        createdByUserId: params.createdByUserId,
        createdByAgentId: params.createdByAgentId,
        createdByServiceIdentityId: params.createdByServiceIdentityId,
        metadata: params.metadata ?? {},
      },
    });
  }

  async listForProject(projectId: string, tenantId: string, opts: {
    simulationId?: string;
    includeSimulation?: boolean;
    limit?: number;
    cursor?: string;
  } = {}) {
    const where: any = { tenantId, projectId };
    if (opts.simulationId) where.simulationId = opts.simulationId;
    if (!opts.includeSimulation) {
      where.NOT = { category: 'SIMULATION', simulationId: { not: null } };
    }
    return this.prisma.timelineEvent.findMany({
      where,
      orderBy: { occurredAt: 'desc' },
      take: opts.limit ?? 50,
      cursor: opts.cursor ? { id: opts.cursor } : undefined,
      skip: opts.cursor ? 1 : 0,
    });
  }

  async findOne(id: string, tenantId: string) {
    const found = await this.prisma.timelineEvent.findFirst({
      where: { id, tenantId },
    });
    if (!found) throw new NotFoundException({ code: 'TIMELINE_EVENT_NOT_FOUND' });
    return found;
  }

  /**
   * Transition a timeline event to a new status. Validates against the
   * matrix; the DB trigger enforces the same constraint.
   */
  async transitionStatus(
    id: string,
    tenantId: string,
    newStatus: TimelineEventStatus,
    actor: { userId?: string; agentId?: string; serviceIdentityId?: string },
  ) {
    const existing = await this.findOne(id, tenantId);
    const allowed = ALLOWED_TRANSITIONS[existing.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException({
        code: 'ILLEGAL_STATUS_TRANSITION',
        message: `Cannot transition from ${existing.status} to ${newStatus}.`,
        details: {
          from: existing.status,
          to: newStatus,
          allowedFromCurrent: allowed,
        },
      });
    }
    // Set invalidation/cancellation metadata if relevant
    const data: any = { status: newStatus };
    if (newStatus === 'INVALIDATED') {
      data.invalidatedAt = new Date();
      data.invalidatedBy = actor.userId ?? actor.agentId ?? actor.serviceIdentityId;
    } else if (newStatus === 'CANCELLED') {
      data.cancelledAt = new Date();
      data.cancelledBy = actor.userId ?? actor.agentId ?? actor.serviceIdentityId;
    }
    return this.prisma.timelineEvent.update({
      where: { id },
      data,
    });
  }

  /**
   * List allowed transitions for a given status. Exposed for client UI.
   */
  allowedTransitions(from: TimelineEventStatus): TimelineEventStatus[] {
    return [...ALLOWED_TRANSITIONS[from]];
  }
}