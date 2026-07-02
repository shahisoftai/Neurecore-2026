import type { HermesAgentType, HermesAgentStatus } from '@prisma/client';
import type { HermesAgentDescriptor } from './hermes-agent.interface';

/**
 * IHermesRegistry — Agent capability registry
 * SRP: manages agent registration, discovery, and capability tracking.
 * DIP: depends on descriptor types, not concrete implementations.
 */
export interface IHermesRegistry {
  register(
    agent: CreateHermesAgentInput,
    tenantId: string,
  ): Promise<HermesAgentDescriptor>;
  unregister(agentId: string, tenantId: string): Promise<void>;
  findById(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentDescriptor | null>;
  findByType(
    type: HermesAgentType,
    tenantId: string,
  ): Promise<HermesAgentDescriptor[]>;
  findByCapability(
    capability: string,
    tenantId: string,
  ): Promise<HermesAgentDescriptor[]>;
  findAll(
    tenantId: string,
    opts?: FindAllOpts,
  ): Promise<PaginatedResult<HermesAgentDescriptor>>;
  update(
    agentId: string,
    input: Partial<UpdateHermesAgentInput>,
    tenantId: string,
  ): Promise<HermesAgentDescriptor>;
  addCapability(
    agentId: string,
    capability: CreateCapabilityInput,
    tenantId: string,
  ): Promise<HermesCapabilityDescriptor>;
  removeCapability(
    agentId: string,
    capabilityId: string,
    tenantId: string,
  ): Promise<void>;
  setToolPermissions(
    agentId: string,
    permissions: ToolPermissionInput[],
    tenantId: string,
  ): Promise<void>;
  recordUsage(
    agentId: string,
    capability: string,
    cost: number,
    duration: number,
  ): Promise<void>;
  getHealth(agentId: string, tenantId: string): Promise<HermesAgentHealth>;
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

export interface CreateCapabilityInput {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  costEstimate?: number;
  avgDuration?: number;
}

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

export interface ToolPermissionInput {
  toolName: string;
  permission: string;
  conditions?: Record<string, unknown>;
}

export interface FindAllOpts {
  status?: HermesAgentStatus;
  type?: HermesAgentType;
  isActive?: boolean;
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

export interface HermesAgentHealth {
  agentId: string;
  status: HermesAgentStatus;
  totalRequests: number;
  avgResponseTime: number;
  successRate: number;
  dailyCost: number;
  dailyLimit: number;
  memoryUsage: { personal: number; episodic: number; procedural: number };
}
