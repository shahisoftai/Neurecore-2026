import { Injectable, Logger } from '@nestjs/common';
import type { IHermesEventBus } from '../interfaces/hermes-event-bus.interface';
import type { HermesEvent, HermesEventHandler } from '../common/hermes.types';
import { EventEmitter } from 'events';

@Injectable()
export class HermesEventBusService implements IHermesEventBus {
  private readonly logger = new Logger(HermesEventBusService.name);
  private readonly emitter = new EventEmitter();

  emit(event: HermesEvent): void {
    this.logger.debug(
      `[HermesEventBus] event=${event.type} hermesAgentId=${event.hermesAgentId}`,
    );
    this.emitter.emit(event.type, event);
    this.emitter.emit('*', event);
  }

  subscribe(handler: HermesEventHandler): () => void {
    this.emitter.on('*', handler);
    return () => {
      this.emitter.off('*', handler);
    };
  }

  linkToLangGraph(threadId: string): void {
    this.logger.debug(
      `[HermesEventBus] linked to LangGraph thread: ${threadId}`,
    );
  }
}
