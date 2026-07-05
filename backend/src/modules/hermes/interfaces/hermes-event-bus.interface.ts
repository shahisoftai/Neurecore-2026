import type { HermesEvent, HermesEventHandler } from '../common/hermes.types';

export interface IHermesEventBus {
  emit(event: HermesEvent): void;
  subscribe(handler: HermesEventHandler): () => void;
  linkToLangGraph(threadId: string): void;
}

export const HERMES_EVENT_BUS = Symbol('HERMES_EVENT_BUS');
