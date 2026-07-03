import type { HermesAgentType, ToolPermissionLevel, UserRole } from '@prisma/client';

export interface PermissionContext {
  roles: UserRole[];
  hermesType: HermesAgentType;
  tenantId: string;
  workspaceId?: string;
  resource?: string;
  action: 'read' | 'write' | 'execute' | 'delete';
}

export interface PermissionMatrixRow {
  hermesType: HermesAgentType;
  role: UserRole;
  tool: string;
  level: ToolPermissionLevel;
  conditions?: Record<string, unknown>;
}

export interface GrantPermissionInput {
  hermesType: HermesAgentType;
  role: UserRole;
  tool: string;
  level: ToolPermissionLevel;
  conditions?: Record<string, unknown>;
}

export type RevokePermissionInput = Omit<GrantPermissionInput, 'level' | 'conditions'>;

export interface IPermissionMatrix {
  can(context: PermissionContext): Promise<boolean>;
  getAllowedTools(
    hermesType: HermesAgentType,
    roles: UserRole[],
    tenantId: string,
  ): Promise<string[]>;
  grant(params: GrantPermissionInput): Promise<void>;
  revoke(params: RevokePermissionInput): Promise<void>;
  getMatrix(tenantId: string): Promise<PermissionMatrixRow[]>;
}
