import type { HermesAgentType } from '@prisma/client';
import type { HermesAgentProfile } from '../common/hermes.types';

export interface IHermesRegistry {
  findById(id: string): Promise<HermesAgentProfile | null>;
  findByType(
    type: HermesAgentType,
    tenantId: string,
  ): Promise<HermesAgentProfile[]>;
  getAllowedTools(hermesType: HermesAgentType): string[];
  ensureHermesAgent(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentProfile>;
}

export const HERMES_REGISTRY = Symbol('HERMES_REGISTRY');
