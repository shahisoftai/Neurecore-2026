/**
 * AgentPoolService - SOLID: Single Responsibility Principle
 *
 * SRP: ONLY manages tier<->agent template mappings
 * DIP: Depends on PrismaService abstraction
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';

export interface AddToPoolInput {
  tierId: string;
  templateId: string;
  slot?: number;
  isRequired?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  isDefaultSelected?: boolean;
}

export interface UpdatePoolEntryInput {
  slot?: number;
  isRequired?: boolean;
  defaultBudgetPerDay?: number;
  defaultModel?: string;
  isDefaultSelected?: boolean;
}

export interface IAgentPoolService {
  findByTierId(tierId: string): Promise<any[]>;
  findById(id: string): Promise<any>;
  addToPool(input: AddToPoolInput): Promise<any>;
  updatePoolEntry(id: string, input: UpdatePoolEntryInput): Promise<any>;
  removeFromPool(id: string): Promise<void>;
  reorderPool(tierId: string, orderedIds: string[]): Promise<any[]>;
}

@Injectable()
export class AgentPoolService implements IAgentPoolService {
  private readonly logger = new Logger(AgentPoolService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByTierId(tierId: string) {
    return this.prisma.tierAgentPool.findMany({
      where: { tierId },
      include: { template: true },
      orderBy: { slot: 'asc' },
    });
  }

  async findById(id: string) {
    const entry = await this.prisma.tierAgentPool.findUnique({
      where: { id },
      include: { template: true, tier: true },
    });
    if (!entry) {
      throw new NotFoundException(`Pool entry ${id} not found`);
    }
    return entry;
  }

  async addToPool(input: AddToPoolInput) {
    // Verify tier exists
    const tier = await this.prisma.tier.findUnique({
      where: { id: input.tierId },
    });
    if (!tier) {
      throw new NotFoundException(`Tier ${input.tierId} not found`);
    }

    // Verify template exists and is public
    const template = await this.prisma.agentTemplate.findUnique({
      where: { id: input.templateId },
    });
    if (!template) {
      throw new NotFoundException(
        `Agent template ${input.templateId} not found`,
      );
    }

    // Check for duplicate
    const existing = await this.prisma.tierAgentPool.findUnique({
      where: {
        tierId_templateId: {
          tierId: input.tierId,
          templateId: input.templateId,
        },
      },
    });
    if (existing) {
      throw new BadRequestException(
        `Template ${template.name} already in tier ${tier.name}`,
      );
    }

    // Get next slot number if not provided
    const slot = input.slot ?? (await this.getNextSlot(input.tierId));

    const entry = await this.prisma.tierAgentPool.create({
      data: {
        tierId: input.tierId,
        templateId: input.templateId,
        slot,
        isRequired: input.isRequired ?? false,
        defaultBudgetPerDay: input.defaultBudgetPerDay,
        defaultModel: input.defaultModel,
        isDefaultSelected: input.isDefaultSelected ?? true,
      },
      include: { template: true },
    });

    this.logger.log(
      `Added ${template.name} to tier ${tier.name} at slot ${slot}`,
    );
    return entry;
  }

  async updatePoolEntry(id: string, input: UpdatePoolEntryInput) {
    const existing = await this.findById(id);

    const data: Prisma.TierAgentPoolUpdateInput = {
      ...(input.slot !== undefined && { slot: input.slot }),
      ...(input.isRequired !== undefined && { isRequired: input.isRequired }),
      ...(input.defaultBudgetPerDay !== undefined && {
        defaultBudgetPerDay: input.defaultBudgetPerDay,
      }),
      ...(input.defaultModel !== undefined && {
        defaultModel: input.defaultModel,
      }),
      ...(input.isDefaultSelected !== undefined && {
        isDefaultSelected: input.isDefaultSelected,
      }),
    };

    const updated = await this.prisma.tierAgentPool.update({
      where: { id },
      data,
      include: { template: true },
    });

    this.logger.log(`Updated pool entry ${id}`);
    return updated;
  }

  async removeFromPool(id: string) {
    const entry = await this.findById(id);

    // Check if any tenants have this agent selected
    const agentCount = await this.prisma.agent.count({
      where: { tierAgentPoolId: id, isSelected: true },
    });
    if (agentCount > 0) {
      throw new BadRequestException(
        `Cannot remove - ${agentCount} tenant(s) have this agent selected`,
      );
    }

    await this.prisma.tierAgentPool.delete({ where: { id } });
    this.logger.log(`Removed pool entry ${id}`);
  }

  async reorderPool(tierId: string, orderedIds: string[]) {
    // Update slot for each entry
    const updates = orderedIds.map((id, index) =>
      this.prisma.tierAgentPool.update({
        where: { id },
        data: { slot: index + 1 },
      }),
    );

    const reordered = await this.prisma.$transaction(updates);
    this.logger.log(
      `Reordered ${reordered.length} pool entries for tier ${tierId}`,
    );
    return reordered;
  }

  private async getNextSlot(tierId: string): Promise<number> {
    const last = await this.prisma.tierAgentPool.findFirst({
      where: { tierId },
      orderBy: { slot: 'desc' },
      select: { slot: true },
    });
    return (last?.slot ?? 0) + 1;
  }
}
