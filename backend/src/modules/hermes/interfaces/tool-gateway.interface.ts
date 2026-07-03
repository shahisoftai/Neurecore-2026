import type { ToolPermissionLevel } from '@prisma/client';

export interface ToolExecutionRequest {
  hermesAgentId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId: string;
  tenantId: string;
  workspaceId?: string;
  userId: string;
}

export interface ToolGatewayDecision {
  allowed: boolean;
  toolName: string;
  decision: ToolPermissionLevel;
  reason?: string;
  requiredApprovalId?: string;
  governanceRule?: string;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  output?: Record<string, unknown>;
  error?: string;
  errorCode?: string;
  durationMs: number;
  costUsd: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  permission: ToolPermissionLevel;
  conditions?: Record<string, unknown>;
}

export interface IToolGateway {
  validate(
    request: ToolExecutionRequest,
  ): Promise<ToolGatewayDecision>;
  execute(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResult>;
  getAllowedTools(
    hermesAgentId: string,
    tenantId: string,
  ): Promise<string[]>;
  buildToolMenu(
    hermesAgentId: string,
    tenantId: string,
  ): Promise<ToolDefinition[]>;
}
