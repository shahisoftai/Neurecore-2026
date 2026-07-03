import type { SessionStatus, MessageRole } from '@prisma/client';
import type { HermesSession, HermesMessage } from '@prisma/client';

export interface CreateSessionInput {
  hermesAgentId: string;
  userId: string;
  tenantId: string;
  workspaceId?: string;
  context?: Record<string, unknown>;
}

export interface AddMessageInput {
  sessionId: string;
  role: MessageRole;
  content: string;
  toolCalls?: Record<string, unknown>;
  toolResults?: Record<string, unknown>;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface SessionWithMessages extends HermesSession {
  messages: HermesMessage[];
  messageCount: number;
}

export interface IHermesSession {
  create(input: CreateSessionInput): Promise<HermesSession>;
  findById(
    id: string,
    tenantId: string,
  ): Promise<SessionWithMessages | null>;
  findByAgent(
    hermesAgentId: string,
    tenantId: string,
    limit?: number,
  ): Promise<HermesSession[]>;
  findByUser(
    userId: string,
    tenantId: string,
    limit?: number,
  ): Promise<HermesSession[]>;
  addMessage(input: AddMessageInput): Promise<HermesMessage>;
  getMessages(
    sessionId: string,
    tenantId: string,
    limit?: number,
  ): Promise<HermesMessage[]>;
  getConversationHistory(
    sessionId: string,
  ): Promise<
    Array<{
      role: string;
      content: string;
      toolCalls: unknown;
      toolResults: unknown;
      createdAt: Date;
    }>
  >;
  updateStatus(
    id: string,
    tenantId: string,
    status: SessionStatus,
  ): Promise<HermesSession>;
  closeSession(id: string, tenantId: string): Promise<void>;
  expireStaleSessions(tenantId: string): Promise<number>;
}
