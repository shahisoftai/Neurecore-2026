import { Injectable, Logger } from '@nestjs/common';
import type {
  DomainEvent,
  EventHandler,
  ProjectEventType,
} from './interfaces/event.types';

/**
 * @deprecated Phase 2 (ADR-001 §12). Superseded by the durable Enterprise Event
 * Fabric (`modules/enterprise-events`, `EnterpriseEventTransport`). This
 * in-memory, non-durable bus is retained ONLY for the legacy project-memory
 * handlers during a time-limited compatibility window; new cross-capability
 * events MUST be published through the fabric. No new producers/consumers may
 * be added here. Cross-capability facts that were previously carried here
 * (e.g. TaskCompleted) now also publish the durable `enterprise.task.completed`
 * event via the fabric.
 */
@Injectable()
export class ProjectEventBus {
  private readonly handlers = new Map<ProjectEventType, Set<EventHandler>>();
  private readonly logger = new Logger(ProjectEventBus.name);

  publish<T = unknown>(event: DomainEvent<T>): void {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) return;

    for (const handler of handlers) {
      try {
        const result = handler(event);
        if (result instanceof Promise) {
          result.catch((err) =>
            this.logger.error(
              `Async handler error for event ${event.type}: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }
      } catch (err) {
        this.logger.error(
          `Handler error for event ${event.type}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  subscribe<T = unknown>(
    type: ProjectEventType,
    handler: EventHandler<T>,
  ): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler as EventHandler);

    return () => {
      this.handlers.get(type)?.delete(handler as EventHandler);
    };
  }

  unsubscribe(type: ProjectEventType, handler: EventHandler): void {
    this.handlers.get(type)?.delete(handler);
  }

  unsubscribeAll(type: ProjectEventType): void {
    this.handlers.delete(type);
  }
}
