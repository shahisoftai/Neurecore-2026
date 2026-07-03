import type { HermesAgentType, HermesAgent } from '@prisma/client';
import type {
  HermesAgentDescriptor,
  RegisterAgentInput,
  UpdateAgentInput,
  CapabilityInput,
} from './hermes-agent.interface';

export interface IHermesRegistry {
  register(input: RegisterAgentInput, tenantId: string): Promise<HermesAgent>;
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
  listAgents(tenantId: string): Promise<HermesAgentDescriptor[]>;
  update(
    agentId: string,
    tenantId: string,
    input: UpdateAgentInput,
  ): Promise<HermesAgent>;
  updateCapability(
    agentId: string,
    tenantId: string,
    cap: CapabilityInput,
  ): Promise<void>;
  removeCapability(
    agentId: string,
    tenantId: string,
    capabilityName: string,
  ): Promise<void>;
  recordUsage(
    agentId: string,
    capability: string,
    cost: number,
    duration: number,
  ): Promise<void>;
  setStatus(
    agentId: string,
    tenantId: string,
    status: HermesAgent['status'],
  ): Promise<void>;
  updateToolPermission(
    agentId: string,
    tenantId: string,
    toolName: string,
    permission: string,
    conditions?: Record<string, unknown>,
  ): Promise<void>;
}
