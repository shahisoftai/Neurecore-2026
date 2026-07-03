export type HermesEventType =
  | 'hermes:start'
  | 'hermes:end'
  | 'hermes:token'
  | 'hermes:tool:call'
  | 'hermes:tool:result'
  | 'hermes:tool:denied'
  | 'hermes:approval:requested'
  | 'hermes:approval:completed'
  | 'hermes:memory:stored'
  | 'hermes:error';

export interface HermesEvent {
  type: HermesEventType;
  hermesAgentId: string;
  sessionId: string;
  tenantId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  traceId: string;
}

export type HermesEventHandler = (event: HermesEvent) => void;

export interface IHermesEventBus {
  emit(event: HermesEvent): void;
  subscribe(handler: HermesEventHandler): () => void;
  linkToLangGraph(threadId: string): void;
  getEventsForSession(
    sessionId: string,
  ): HermesEvent[];
}
