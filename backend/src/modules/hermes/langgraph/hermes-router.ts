import { Injectable, Logger } from '@nestjs/common';
import type { HermesAgentType } from '@prisma/client';
import { HermesRegistryService } from '../services/hermes-registry.service';

@Injectable()
export class HermesRouter {
  private readonly logger = new Logger(HermesRouter.name);

  constructor(private readonly registry: HermesRegistryService) {}

  async selectHermesAgent(params: {
    task: string;
    intent?: { capability: string };
    tenantId: string;
  }): Promise<{ hermesAgentId: string; hermesType: HermesAgentType } | null> {
    if (!params.intent?.capability) {
      return null;
    }

    const type = this.mapCapabilityToType(params.intent.capability);
    if (!type) return null;

    const agents = await this.registry.findByType(type, params.tenantId);

    if (agents.length === 0) {
      this.logger.warn(
        `No Hermes agent found for capability: ${params.intent.capability} (type: ${type})`,
      );
      return null;
    }

    const selected = agents[0];
    return { hermesAgentId: selected.id, hermesType: selected.type };
  }

  private mapCapabilityToType(capability: string): HermesAgentType | null {
    const map: Record<string, HermesAgentType> = {
      hr: 'HR',
      human_resources: 'HR',
      finance: 'FINANCE',
      accounting: 'FINANCE',
      sales: 'SALES',
      crm: 'SALES',
      marketing: 'MARKETING',
      legal: 'LEGAL',
      compliance: 'LEGAL',
      research: 'RESEARCH',
      engineering: 'ENGINEERING',
      development: 'ENGINEERING',
      qa: 'QA',
      testing: 'QA',
      security: 'SECURITY',
      operations: 'OPERATIONS',
      support: 'CUSTOMER_SUPPORT',
      customer_service: 'CUSTOMER_SUPPORT',
    };
    return map[capability.toLowerCase()] ?? null;
  }
}
