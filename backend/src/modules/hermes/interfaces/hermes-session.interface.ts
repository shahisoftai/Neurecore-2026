export interface HermesSessionData {
  id: string;
  hermesAgentId: string;
  userId?: string;
  tenantId: string;
  workspaceId?: string;
  threadId: string;
  status: string;
  context: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface HermesMessageData {
  id: string;
  sessionId: string;
  role: 'USER' | 'HERMES' | 'SYSTEM';
  content: string;
  metadata?: Record<string, unknown>;
  toolCalls?: unknown;
  toolResults?: unknown;
  error?: string;
  createdAt: Date;
}

export interface IHermesSession {
  create(
    hermesAgentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ): Promise<HermesSessionData>;
  get(threadId: string): Promise<HermesSessionData | null>;
  addMessage(
    sessionId: string,
    role: 'USER' | 'HERMES' | 'SYSTEM',
    content: string,
    metadata?: Record<string, unknown>,
  ): Promise<HermesMessageData>;
  getMessages(sessionId: string): Promise<HermesMessageData[]>;
  updateStatus(sessionId: string, status: string): Promise<void>;
}

export const HERMES_SESSION = Symbol('HERMES_SESSION');
