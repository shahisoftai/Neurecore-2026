import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import {
  HERMES_EVENT_BUS,
  type IHermesEventBus,
} from '../interfaces/hermes-event-bus.interface';
import type { HermesEvent, HermesEventHandler } from '../common/hermes.types';
import { EventEmitter } from 'events';
import {
  ACTIVITY_SERVICE,
  type IActivityService,
} from '../interfaces/IActivityService';
import type { IDependencyGraph } from '../interfaces/IDependencyGraph';
import { EventsGateway } from '../../events/events.gateway';
import type { EntityType } from '@prisma/client';

const ENTITY_TYPE_VALUES: ReadonlySet<string> = new Set([
  'DEPARTMENT',
  'AGENT',
  'USER',
  'PROJECT',
  'GOAL',
  'TASK',
  'WORKFLOW',
  'ROUTINE',
  'TOOL_INTEGRATION',
  'EXPENSE',
  'INVOICE',
  'KNOWLEDGE_ENTRY',
  'TEMPLATE',
  'FACILITY',
  'CUSTOMER',
  'ASSET',
  'VENDOR',
  'PROCESS',
  'DOCUMENT',
]);

/**
 * EnterpriseEventBusService — persisted EventBus (Phase 2).
 *
 * Replaces HermesEventBusService's in-memory fan-out with a write-through
 * to the canonical ActivityEvent table. Events without a tenantId are
 * dropped (security isolation). Falls back to in-memory emit for any
 * legacy subscribers.
 *
 * Phase 9d (§16.4.2): also walks `DEPENDS_ON` edges to fan out
 * `dependency:updated` events to entities that depend on the changed one.
 */
@Injectable()
export class EnterpriseEventBusService implements IHermesEventBus {
  private readonly logger = new Logger(EnterpriseEventBusService.name);
  private readonly emitter = new EventEmitter();

  constructor(
    @Inject(ACTIVITY_SERVICE)
    private readonly activityService: IActivityService,
    private readonly eventsGateway: EventsGateway,
    @Optional() private readonly dependencyGraph?: IDependencyGraph,
  ) {}

  emit(event: HermesEvent): void {
    const data = event.data ?? {};
    const tenantId = data.tenantId as string | undefined;
    if (!tenantId) {
      this.logger.warn(
        `Dropping event ${event.type} — no tenantId (security isolation)`,
      );
      return;
    }

    const entityType = data.entityType as string | undefined;
    const entityId = data.entityId as string | undefined;

    this.activityService
      .record({
        tenantId,
        actorType: 'AI_AGENT',
        actorId: event.hermesAgentId,
        type: event.type,
        title: event.type,
        description: undefined,
        threadId: (data.threadId as string | undefined) ?? undefined,
        contextType: (data.contextType as string | undefined) ?? undefined,
        contextId: (data.contextId as string | undefined) ?? undefined,
        entityType,
        entityId,
        payload: data,
        severity: event.type === 'hermes:error' ? 'error' : 'info',
        sourceEventId: `${event.type}:${event.sessionId}:${event.timestamp}`,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      })
      .catch((err) =>
        this.logger.warn(
          `Activity record failed for ${event.type}: ${String(err)}`,
        ),
      );

    this.eventsGateway.emitToTenant(tenantId, 'activity:new', event);
    const threadId = data.threadId as string | undefined;
    if (threadId) {
      this.eventsGateway.emitToRoom(
        `thread:${threadId}`,
        'thread:activity',
        event,
      );
    }

    if (
      this.dependencyGraph &&
      entityType &&
      entityId &&
      ENTITY_TYPE_VALUES.has(entityType)
    ) {
      this.fanOutDependents(
        tenantId,
        entityType as EntityType,
        entityId,
        event.type,
      ).catch((err) =>
        this.logger.warn(
          `dependency fan-out failed for ${entityType}:${entityId}: ${String(err)}`,
        ),
      );
    }

    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  private async fanOutDependents(
    tenantId: string,
    entityType: EntityType,
    entityId: string,
    eventType: string,
  ): Promise<void> {
    if (!this.dependencyGraph) return;
    const dependents = await this.dependencyGraph.findDependents(
      tenantId,
      entityType,
      entityId,
    );
    if (dependents.length === 0) return;
    this.eventsGateway.emitToTenant(tenantId, 'dependency:updated', {
      changedEntity: { type: entityType, id: entityId },
      dependents,
      event: eventType,
      timestamp: Date.now(),
    });
  }

  subscribe(handler: HermesEventHandler): () => void {
    this.emitter.on('*', handler);
    return () => {
      this.emitter.off('*', handler);
    };
  }

  linkToLangGraph(threadId: string): void {
    this.logger.debug(
      `[EnterpriseEventBus] linked to LangGraph thread: ${threadId}`,
    );
  }
}
