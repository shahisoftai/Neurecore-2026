import { Injectable, Logger } from '@nestjs/common';
import type { IHermesEventBus } from '../interfaces/hermes-event-bus.interface';
import type {
  HermesEvent,
  HermesEventType,
  HermesEventHandler,
} from '../interfaces/hermes-event-bus.interface';
import { generateTraceId } from '../common/hermes.utils';
import { HERMES_EVENT_HISTORY_MAX } from '../common/hermes.constants';

@Injectable()
export class HermesEventBusService implements IHermesEventBus {
  private readonly logger = new Logger(HermesEventBusService.name);
  private readonly subscribers: Map<string, Set<HermesEventHandler>> =
    new Map();
  private readonly eventHistory: Map<string, HermesEvent[]> = new Map();
  private linkedThreads: Set<string> = new Set();

  emit(event: HermesEvent): void {
    const enriched: HermesEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date(),
      traceId: event.traceId ?? generateTraceId(),
    };

    this.storeEvent(enriched.sessionId, enriched);

    const handlers = this.subscribers.get(enriched.type) ?? new Set();
    for (const handler of handlers) {
      try {
        handler(enriched);
      } catch (err) {
        this.logger.error(
          `Error in Hermes event handler for ${enriched.type}: ${(err as Error).message}`,
        );
      }
    }

    const allHandlers = this.subscribers.get('*') ?? new Set();
    for (const handler of allHandlers) {
      try {
        handler(enriched);
      } catch {
        // Silently continue on handler errors
      }
    }
  }

  subscribe(handler: HermesEventHandler): () => void {
    const key = '*';
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(handler);

    return () => {
      this.subscribers.get(key)?.delete(handler);
    };
  }

  subscribeToType(
    type: HermesEventType,
    handler: HermesEventHandler,
  ): () => void {
    if (!this.subscribers.has(type)) {
      this.subscribers.set(type, new Set());
    }
    this.subscribers.get(type)!.add(handler);

    return () => {
      this.subscribers.get(type)?.delete(handler);
    };
  }

  linkToLangGraph(threadId: string): void {
    this.linkedThreads.add(threadId);
    this.logger.debug(
      `Linked Hermes event bus to LangGraph thread ${threadId}`,
    );
  }

  getEventsForSession(
    sessionId: string,
  ): HermesEvent[] {
    return this.eventHistory.get(sessionId) ?? [];
  }

  private storeEvent(
    sessionId: string,
    event: HermesEvent,
  ): void {
    if (!this.eventHistory.has(sessionId)) {
      this.eventHistory.set(sessionId, []);
    }

    const history = this.eventHistory.get(sessionId)!;
    history.push(event);

    while (history.length > HERMES_EVENT_HISTORY_MAX) {
      history.shift();
    }
  }
}
