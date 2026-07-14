import type { HermesAgentType, HermesAgentStatus } from '@prisma/client';
import type { StepResult } from '../../agents/interfaces/agent-executor.interface';

export interface HermesExecutionContext {
  sessionId: string;
  hermesAgentId: string;
  task: string;
  context: {
    tenantId: string;
    workspaceId?: string;
    userId?: string;
    threadId: string;
    agentId?: string;
    hopCount?: number;
  };
  /** If true and agentId is provided, auto-create HermesAgent if missing */
  autoLink?: boolean;
}

export interface HermesExecuteResult {
  success: boolean;
  output?: unknown;
  error?: string;
  steps: StepResult[];
  durationMs: number;
  tokensUsed?: number;
  costUsd?: number;
}

export interface ToolValidationResult {
  allowed: boolean;
  requiresApproval: boolean;
  reason?: string;
}

export interface HermesAgentProfile {
  id: string;
  name: string;
  type: HermesAgentType;
  status: HermesAgentStatus;
  model?: string;
  systemPrompt?: string;
  isActive: boolean;
  tenantId: string;
  workspaceId?: string;
}

export interface HermesSessionContext {
  threadId: string;
  hermesAgentId: string;
  userId?: string;
  tenantId: string;
  workspaceId?: string;
  memoryContext?: string; // joined string of last 20 memory entries (actor-local)
  allowedTools: string[]; // tool names from registry.getAllowedTools(type) (actor-local)
  // Phase 3: organizational state obtained via the Context Plane (ADR-002).
  // capabilityName → authorized capability context (access + provenance + data).
  organization?: Record<string, unknown>;
}

export interface HermesEvent {
  type: string;
  hermesAgentId: string;
  sessionId: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export type HermesEventHandler = (event: HermesEvent) => void;
