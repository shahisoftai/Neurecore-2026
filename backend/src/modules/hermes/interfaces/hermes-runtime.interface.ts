import type { HermesAgentStatus, SessionStatus } from '@prisma/client';
import type { HermesSession } from '@prisma/client';

export interface HermesExecutionContext {
  tenantId: string;
  workspaceId?: string;
  userId: string;
  threadId: string;
  hermesNodeId?: string;
  parentTraceId?: string;
  permissionContext?: Record<string, unknown>;
}

export interface HermesExecutionRequest {
  sessionId: string;
  hermesAgentId: string;
  task: string;
  context: HermesExecutionContext;
  tools?: string[];
  maxIterations?: number;
  temperature?: number;
}

export interface HermesExecutionResult {
  success: boolean;
  sessionId: string;
  content: string;
  toolCalls: HermesToolCallRecord[];
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  costUsd: number;
  durationMs: number;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
}

export interface HermesToolCallRecord {
  toolName: string;
  toolInput: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  error?: string;
  durationMs: number;
  costUsd: number;
  decision: string;
}

export interface HermesStreamEvent {
  type:
    | 'hermes:start'
    | 'hermes:end'
    | 'hermes:token'
    | 'hermes:tool:call'
    | 'hermes:tool:result'
    | 'hermes:tool:denied'
    | 'hermes:error'
    | 'hermes:approval:requested';
  data: Record<string, unknown>;
  timestamp: Date;
}

export interface IHermesRuntime {
  execute(
    request: HermesExecutionRequest,
  ): Promise<HermesExecutionResult>;
  stream(
    request: HermesExecutionRequest,
  ): AsyncGenerator<HermesStreamEvent>;
  suspend(agentId: string, tenantId: string): Promise<void>;
  resume(agentId: string, tenantId: string): Promise<void>;
  getStatus(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentStatus>;
  createSession(
    agentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ): Promise<HermesSession>;
}
