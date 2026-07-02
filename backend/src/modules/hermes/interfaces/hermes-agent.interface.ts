import type { HermesAgentType, HermesAgentStatus } from '@prisma/client';

/**
 * IHermesAgent — Core agent entity descriptor
 * SRP: represents only the identity and status of a Hermes agent.
 */
export interface HermesAgentDescriptor {
  id: string;
  name: string;
  type: HermesAgentType;
  description?: string;
  status: HermesAgentStatus;
  model?: string;
  systemPrompt?: string;
  isActive: boolean;
  tenantId: string;
  workspaceId?: string;
  permissions: string[];
  allowedPaths: string[];
  blockedPaths: string[];
  maxFileSize: number;
  config?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * HermesCapability — a discrete skill or action an agent can perform
 */
export interface HermesCapabilityDescriptor {
  id: string;
  hermesAgentId: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  costEstimate?: number;
  avgDuration?: number;
  usageCount: number;
}

/**
 * HermesToolPermission — per-tool permission for an agent
 */
export interface HermesToolPermissionDescriptor {
  id: string;
  hermesAgentId: string;
  toolName: string;
  permission: string;
  conditions?: Record<string, unknown>;
}

/**
 * IHermesAgent — interface for Hermes agent CRUD operations
 * ISP: focused only on agent lifecycle and registry operations.
 */
export interface IHermesAgent {
  register(
    input: CreateHermesAgentInput,
    tenantId: string,
  ): Promise<HermesAgentDescriptor>;
  findById(id: string, tenantId: string): Promise<HermesAgentDescriptor | null>;
  findByType(
    type: HermesAgentType,
    tenantId: string,
  ): Promise<HermesAgentDescriptor[]>;
  update(
    id: string,
    input: Partial<UpdateHermesAgentInput>,
    tenantId: string,
  ): Promise<HermesAgentDescriptor>;
  archive(id: string, tenantId: string): Promise<void>;
  updateStatus(
    id: string,
    status: HermesAgentStatus,
    tenantId: string,
  ): Promise<HermesAgentDescriptor>;
}

export interface CreateHermesAgentInput {
  name: string;
  type: HermesAgentType;
  description?: string;
  model?: string;
  systemPrompt?: string;
  permissions?: string[];
  allowedPaths?: string[];
  blockedPaths?: string[];
  maxFileSize?: number;
  config?: Record<string, unknown>;
  workspaceId?: string;
  isActive?: boolean;
}

export interface UpdateHermesAgentInput {
  name?: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  permissions?: string[];
  allowedPaths?: string[];
  blockedPaths?: string[];
  maxFileSize?: number;
  config?: Record<string, unknown>;
  isActive?: boolean;
}
