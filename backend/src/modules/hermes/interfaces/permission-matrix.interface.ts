import type {
  HermesAgentType,
  HermesMemoryType,
  ToolPermissionLevel,
} from '@prisma/client';
import type { UserRole } from '@prisma/client';

/**
 * IPermissionMatrix — Role × AgentType × Tool permission matrix
 * SRP: computes whether a given action is permitted.
 * DIP: depends on primitive types, not concrete services.
 */
export interface IPermissionMatrix {
  can(context: PermissionCheckContext): Promise<boolean>;
  getAllowedTools(
    hermesType: HermesAgentType,
    roles: UserRole[],
    tenantId: string,
  ): Promise<string[]>;
  grant(input: GrantPermissionInput): Promise<void>;
  revoke(input: RevokePermissionInput): Promise<void>;
  getMatrix(tenantId: string): Promise<PermissionMatrixRow[]>;
  getDefaults(): PermissionMatrixRow[];
}

export interface PermissionCheckContext {
  hermesType: HermesAgentType;
  roles: UserRole[];
  toolName: string;
  action: PermissionAction;
  tenantId: string;
  workspaceId?: string;
  resource?: string;
}

export type PermissionAction = 'read' | 'write' | 'execute' | 'delete';

export interface PermissionMatrixRow {
  id: string;
  hermesType: HermesAgentType;
  role: UserRole;
  toolName: string;
  level: ToolPermissionLevel;
  conditions?: Record<string, unknown>;
  tenantId?: string;
}

export interface GrantPermissionInput {
  hermesType: HermesAgentType;
  role: UserRole;
  toolName: string;
  level: ToolPermissionLevel;
  conditions?: Record<string, unknown>;
  tenantId: string;
}

export interface RevokePermissionInput {
  hermesType: HermesAgentType;
  role: UserRole;
  toolName: string;
  tenantId: string;
}
