import type { SessionStatus, MessageRole } from '@prisma/client';

/**
 * IHermesSession — Conversation session management
 * SRP: manages session lifecycle and message history only.
 */
export interface IHermesSession {
  create(
    agentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ): Promise<HermesSessionDescriptor>;
  findById(
    sessionId: string,
    tenantId: string,
  ): Promise<HermesSessionDescriptor | null>;
  findByThread(
    threadId: string,
    tenantId: string,
  ): Promise<HermesSessionDescriptor | null>;
  findByAgent(
    agentId: string,
    tenantId: string,
    opts?: SessionFindOpts,
  ): Promise<PaginatedResult<HermesSessionDescriptor>>;
  addMessage(
    sessionId: string,
    message: AddMessageInput,
    tenantId: string,
  ): Promise<HermesMessageDescriptor>;
  getMessages(
    sessionId: string,
    tenantId: string,
    limit?: number,
  ): Promise<HermesMessageDescriptor[]>;
  updateStatus(
    sessionId: string,
    status: SessionStatus,
    tenantId: string,
  ): Promise<HermesSessionDescriptor>;
  extend(sessionId: string, tenantId: string, hours?: number): Promise<void>;
  archive(sessionId: string, tenantId: string): Promise<void>;
  getActiveCount(agentId: string, tenantId: string): Promise<number>;
}

export interface HermesSessionDescriptor {
  id: string;
  hermesAgentId: string;
  userId: string;
  tenantId: string;
  workspaceId?: string;
  threadId: string;
  status: SessionStatus;
  context: Record<string, unknown>;
  messageCount: number;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface HermesMessageDescriptor {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  error?: string;
  createdAt: Date;
}

export interface ToolCall {
  tool: string;
  input: Record<string, unknown>;
  callId?: string;
}

export interface ToolResult {
  tool: string;
  output: unknown;
  error?: string;
  callId?: string;
}

export interface AddMessageInput {
  role: MessageRole;
  content: string;
  metadata?: Record<string, unknown>;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  error?: string;
}

export interface SessionFindOpts {
  status?: SessionStatus;
  userId?: string;
  page?: number;
  limit?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
