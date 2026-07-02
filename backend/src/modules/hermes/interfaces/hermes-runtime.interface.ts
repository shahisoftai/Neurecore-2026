import type { HermesAgentType } from '@prisma/client';

/**
 * IHermesContext — Execution context builder
 * SRP: builds structured context objects for Hermes agent execution.
 *      Never executes anything — only assembles context.
 */
export interface IHermesContext {
  build(request: HermesExecutionRequest): Promise<HermesExecutionContext>;
  buildSystemPrompt(agentId: string, tenantId: string): Promise<string>;
  injectMemory(
    agentId: string,
    context: HermesExecutionContext,
    maxTokens?: number,
  ): Promise<string>;
  enrichWithGovernance(
    context: HermesExecutionContext,
    tenantId: string,
  ): Promise<GovernanceContext>;
}

export interface HermesExecutionRequest {
  sessionId: string;
  hermesAgentId: string;
  task: string;
  context: {
    tenantId: string;
    workspaceId?: string;
    userId: string;
    threadId: string;
    hermesNodeId?: string;
    parentTraceId?: string;
  };
  tools?: string[];
  maxIterations?: number;
}

export interface HermesExecutionContext {
  sessionId: string;
  hermesAgentId: string;
  tenantId: string;
  workspaceId?: string;
  userId: string;
  threadId: string;
  hermesNodeId?: string;
  parentTraceId?: string;
  task: string;
  systemPrompt: string;
  memoryContext: string;
  allowedTools: string[];
  governanceContext: GovernanceContext;
  maxIterations: number;
  permissions: string[];
  metadata: Record<string, unknown>;
}

export interface GovernanceContext {
  requiresApproval: boolean;
  approvalWorkflowId?: string;
  blockedRules: string[];
  rateLimited: boolean;
  alerts: string[];
}

export interface HermesExecutionResult {
  sessionId: string;
  hermesAgentId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  toolCalls: ToolCallResult[];
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  messages: HermesMessageResult[];
}

export interface HermesMessageResult {
  role: 'USER' | 'HERMES' | 'SYSTEM';
  content: string;
  toolCalls?: ToolCallResult[];
}

export interface ToolCallResult {
  tool: string;
  input: Record<string, unknown>;
  output?: unknown;
  error?: string;
  allowed: boolean;
  durationMs: number;
}

export interface HermesStreamEvent {
  type: 'chunk' | 'tool_call' | 'tool_result' | 'error' | 'done';
  data: unknown;
  timestamp: Date;
}

export interface IHermesRuntime {
  execute(request: HermesExecutionRequest): Promise<HermesExecutionResult>;
  stream(request: HermesExecutionRequest): AsyncGenerator<HermesStreamEvent>;
  suspend(agentId: string, tenantId: string): Promise<void>;
  resume(agentId: string, tenantId: string): Promise<void>;
  getStatus(agentId: string, tenantId: string): Promise<string>;
  createSession(
    agentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ): Promise<import('./hermes-session.interface').HermesSessionDescriptor>;
}
