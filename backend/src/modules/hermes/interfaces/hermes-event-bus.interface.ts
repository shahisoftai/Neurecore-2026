import type { HermesAgentType } from '@prisma/client';

/**
 * IHermesEventBus — Hermes → LangGraph event forwarding
 * SRP: publishes and manages Hermes lifecycle events.
 * DIP: depends on HermesEvent type, not implementation.
 */
export interface IHermesEventBus {
  emit(event: HermesEvent): void;
  subscribe(handler: HermesEventHandler): () => void;
  linkToLangGraph(threadId: string): void;
  unlink(threadId: string): void;
  getListeners(threadId?: string): number;
}

export type HermesEventHandler = (event: HermesEvent) => void | Promise<void>;

export interface HermesEvent {
  type: HermesEventType;
  hermesAgentId: string;
  sessionId: string;
  tenantId: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  traceId: string;
}

export type HermesEventType =
  | 'hermes:start'
  | 'hermes:end'
  | 'hermes:tool:call'
  | 'hermes:tool:result'
  | 'hermes:tool:denied'
  | 'hermes:approval:requested'
  | 'hermes:approval:completed'
  | 'hermes:memory:stored'
  | 'hermes:error';

export interface HermesAuditLogEntry {
  id: string;
  hermesAgentId: string;
  sessionId?: string;
  taskId?: string;
  tenantId: string;
  workspaceId?: string;
  action: string;
  resource?: string;
  resourceId?: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  decision?: string;
  reason?: string;
  governanceRule?: string;
  durationMs?: number;
  costUsd?: number;
  tokensUsed?: number;
  createdAt: Date;
}
