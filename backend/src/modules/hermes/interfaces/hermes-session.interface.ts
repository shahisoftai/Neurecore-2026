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

export interface MentionRef {
  participantType: 'USER' | 'AI_AGENT' | 'SYSTEM' | 'WORKFLOW' | 'EXTERNAL';
  participantId: string;
}

export interface HermesMessageData {
  id: string;
  sessionId: string;
  threadId?: string | null;
  role: 'USER' | 'HERMES' | 'SYSTEM';
  content: string;
  metadata?: Record<string, unknown>;
  mentions?: MentionRef[];
  toolCalls?: unknown;
  toolResults?: unknown;
  error?: string;
  createdAt: Date;
}

export interface CreateSessionWithThreadParams {
  hermesAgentId: string;
  userId: string;
  tenantId: string;
  workspaceId?: string;
  /** Existing CommunicationThread to attach this session to. */
  threadId?: string;
  /** When threadId is omitted, a new thread is created with this title
   *  (default: "Conversation with <agent-name>"). */
  threadTitle?: string;
  contextType?: string;
  contextId?: string;
}

export interface IHermesSession {
  /** Original 4-positional signature — preserved for LSP/back-compat. */
  create(
    hermesAgentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ): Promise<HermesSessionData>;
  /** Phase 1: enriched signature — auto-creates or attaches to a thread. */
  createWithThread(
    params: CreateSessionWithThreadParams,
  ): Promise<HermesSessionData>;
  get(threadId: string): Promise<HermesSessionData | null>;
  addMessage(
    sessionId: string,
    role: 'USER' | 'HERMES' | 'SYSTEM',
    content: string,
    metadata?: Record<string, unknown>,
    threadId?: string,
    idempotencyKey?: string,
    mentions?: MentionRef[],
  ): Promise<HermesMessageData>;
  getMessages(sessionId: string): Promise<HermesMessageData[]>;
  updateStatus(sessionId: string, status: string): Promise<void>;
}

export const HERMES_SESSION = Symbol('HERMES_SESSION');
