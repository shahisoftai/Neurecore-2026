import type {
  HermesAgentType,
  HermesAgentStatus,
  ToolPermissionLevel,
} from '@prisma/client';

export interface HermesAgentDescriptor {
  id: string;
  name: string;
  type: HermesAgentType;
  description?: string | null;
  model?: string | null;
  systemPrompt?: string | null;
  config: Record<string, unknown>;
  permissions: string[];
  status: HermesAgentStatus;
  isActive: boolean;
  capabilities: HermesCapabilityDescriptor[];
  toolPermissions: HermesToolPermissionRecord[];
  memory: {
    shortTerm: number;
    longTerm: number;
    episodic: number;
  };
  cost: {
    totalSpend: number;
    dailyBudget: number;
  };
  tenantId: string;
  workspaceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface HermesCapabilityDescriptor {
  id: string;
  name: string;
  description?: string | null;
  inputSchema?: Record<string, unknown> | null;
  outputSchema?: Record<string, unknown> | null;
  costEstimate?: number | null;
  avgDuration?: number | null;
  usageCount: number;
}

export interface HermesToolPermissionRecord {
  id: string;
  toolName: string;
  permission: ToolPermissionLevel;
  conditions?: Record<string, unknown> | null;
}

export interface RegisterAgentInput {
  name: string;
  type: HermesAgentType;
  description?: string;
  model?: string;
  systemPrompt?: string;
  config?: Record<string, unknown>;
  permissions?: string[];
  workspaceId?: string;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  config?: Record<string, unknown>;
  permissions?: string[];
  isActive?: boolean;
  workspaceId?: string;
}

export interface CapabilityInput {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  costEstimate?: number;
  avgDuration?: number;
}
