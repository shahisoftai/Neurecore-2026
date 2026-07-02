import type { ToolPermissionLevel } from '@prisma/client';

/**
 * IToolGateway — Tool permission enforcement and dispatch
 * SRP: validates tool calls and routes to StructuredToolRegistry.
 * DIP: depends on IToolGatewayDecision, not implementation details.
 */
export interface IToolGateway {
  validate(request: ToolExecutionRequest): Promise<ToolGatewayDecision>;
  execute(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
  getAllowedTools(hermesAgentId: string, tenantId: string): Promise<string[]>;
  buildToolMenu(
    hermesAgentId: string,
    tenantId: string,
  ): Promise<ToolMenuItem[]>;
}

export interface ToolExecutionRequest {
  hermesAgentId: string;
  toolName: string;
  toolInput: Record<string, unknown>;
  sessionId: string;
  tenantId: string;
  workspaceId?: string;
  userId?: string;
}

export interface ToolGatewayDecision {
  allowed: boolean;
  toolName: string;
  level: ToolPermissionLevel;
  reason?: string;
  requiredApprovalId?: string;
  governanceRule?: string;
  sanitizedInput?: Record<string, unknown>;
}

export interface ToolExecutionResult {
  success: boolean;
  toolName: string;
  output?: unknown;
  error?: string;
  durationMs: number;
  tokensUsed?: number;
  costUsd?: number;
  cached?: boolean;
}

export interface ToolMenuItem {
  name: string;
  description: string;
  category: string;
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
  permission: ToolPermissionLevel;
}
