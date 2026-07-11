import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import type { HermesAgentType } from '@prisma/client';
import type { IHermesRegistry } from '../interfaces/hermes-registry.interface';
import type { HermesAgentProfile } from '../common/hermes.types';
import { HERMES_DEFAULTS } from '../common/hermes.constants';
import { getAllowedToolNames } from '../../tools/built-in/hermes-tools';

/**
 * F4 fix: `getDefaultModelForType(agent.name)` was passing the agent's
 * human name (e.g. "Sarah the SDR") to a function expecting a
 * `HermesAgentType` enum (FINANCE, HR, …), which silently fell through
 * to `gpt-4o-mini`. The fix derives the HermesType from
 * `agent.category` (preferred) or the agent's `type` column, then
 * asks the gateway for the resolved `modelId` for capability
 * `planning`. The gateway is the single source of truth for model
 * selection (per ai-gateway-imp-plan.md §3.1 row S20).
 */
@Injectable()
export class HermesRegistryService implements IHermesRegistry {
  private readonly logger = new Logger(HermesRegistryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlags: FeatureFlagService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async findById(id: string): Promise<HermesAgentProfile | null> {
    const record = await this.prisma.hermesAgent.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.toProfile(record);
  }

  async findByType(
    type: HermesAgentType,
    tenantId: string,
  ): Promise<HermesAgentProfile[]> {
    const records = await this.prisma.hermesAgent.findMany({
      where: { type, tenantId, isActive: true },
    });
    return records.map((r) => this.toProfile(r));
  }

  getAllowedTools(hermesType: HermesAgentType): string[] {
    return getAllowedToolNames(hermesType);
  }

  async ensureHermesAgent(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentProfile> {
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        name: true,
        hermesAgentId: true,
        model: true,
        systemPrompt: true,
        tenantId: true,
        isActive: true,
        type: true,
      },
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.hermesAgentId) {
      const existing = await this.findById(agent.hermesAgentId);
      if (existing) return existing;
    }

    // F4: resolve modelId via the gateway's capability chain. The
    // legacy path kept the original behaviour (returns 'gpt-4o-mini')
    // so existing rows are not invalidated.
    const resolvedModel = await this.resolveDefaultModel(tenantId, agent.model);

    const hermesAgent = await this.prisma.hermesAgent.create({
      data: {
        name: `${agent.name} [Auto]`,
        type: HERMES_DEFAULTS.CUSTOM_TYPE as HermesAgentType,
        tenantId,
        isActive: agent.isActive,
        model: agent.model ?? resolvedModel,
        systemPrompt: agent.systemPrompt ?? undefined,
      },
    });

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { hermesAgentId: hermesAgent.id },
    });

    this.logger.log(
      `Auto-linked Agent ${agentId} → HermesAgent ${hermesAgent.id}`,
    );
    return this.toProfile(hermesAgent);
  }

  private async resolveDefaultModel(
    tenantId: string,
    explicitModel: string | null,
  ): Promise<string> {
    if (explicitModel) return explicitModel;
    if (this.featureFlags.isEnabled('AI_GATEWAY_V2')) {
      try {
        const resolved = await this.aiGateway.select(tenantId, 'planning');
        return resolved.model.modelId;
      } catch (err) {
        this.logger.warn(
          `Gateway model resolution failed for hermes registry: ${String(err)}`,
        );
      }
    }
    return 'gpt-4o-mini';
  }

  private toProfile(record: {
    id: string;
    name: string;
    type: string;
    status: string;
    model: string | null;
    systemPrompt: string | null;
    isActive: boolean;
    tenantId: string;
    workspaceId: string | null;
  }): HermesAgentProfile {
    return {
      id: record.id,
      name: record.name,
      type: record.type as HermesAgentType,
      status: record.status as 'IDLE' | 'RUNNING' | 'SUSPENDED',
      model: record.model ?? undefined,
      systemPrompt: record.systemPrompt ?? undefined,
      isActive: record.isActive,
      tenantId: record.tenantId,
      workspaceId: record.workspaceId ?? undefined,
    };
  }
}
