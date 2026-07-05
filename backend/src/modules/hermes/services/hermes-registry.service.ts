import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { HermesAgentType } from '@prisma/client';
import type { IHermesRegistry } from '../interfaces/hermes-registry.interface';
import type { HermesAgentProfile } from '../common/hermes.types';
import {
  HERMES_DEFAULTS,
  getDefaultModelForType,
} from '../common/hermes.constants';
import { getAllowedToolNames } from '../../tools/built-in/hermes-tools';

@Injectable()
export class HermesRegistryService implements IHermesRegistry {
  private readonly logger = new Logger(HermesRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

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
      },
    });

    if (!agent) {
      throw new Error(`Agent ${agentId} not found`);
    }

    if (agent.hermesAgentId) {
      const existing = await this.findById(agent.hermesAgentId);
      if (existing) return existing;
    }

    const hermesAgent = await this.prisma.hermesAgent.create({
      data: {
        name: `${agent.name} [Auto]`,
        type: HERMES_DEFAULTS.CUSTOM_TYPE as HermesAgentType,
        tenantId,
        isActive: agent.isActive,
        model: agent.model ?? getDefaultModelForType(agent.name),
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
