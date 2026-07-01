import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { AgentStatus, AgentType } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import type {
  IAgentService,
  AgentFilter,
  CreateAgentInput,
  UpdateAgentInput,
} from '../interfaces/agent.interface';

@Injectable()
export class AgentsService implements IAgentService {
  private readonly logger = new Logger(AgentsService.name);
  private readonly driftSafeAgentSelect = {
    id: true,
    name: true,
    description: true,
    type: true,
    status: true,
    model: true,
    systemPrompt: true,
    instructions: true,
    budgetPerDay: true,
    totalSpend: true,
    permissions: true,
    config: true,
    metadata: true,
    isActive: true,
    tenantId: true,
    createdById: true,
    templateId: true,
    templateVersion: true,
    isSelected: true,
    departmentId: true,
    createdAt: true,
    updatedAt: true,
  } as const;

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
  ) {}

  async findAll(filter: AgentFilter, tenantId: string): Promise<{
    data: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const {
      departmentId,
      status,
      type,
      isActive,
      page = 1,
      limit = 20,
    } = filter;
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(departmentId ? { departmentId } : {}),
      ...(status && { status }),
      ...(type && { type }),
      ...(isActive !== undefined && { isActive }),
    };

    try {
      const [data, total] = await this.prisma.$transaction([
        this.prisma.agent.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          include: { _count: { select: { tasks: true } } },
        }),
        this.prisma.agent.count({ where }),
      ]);

      return {
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.warn(
        `Agents.findAll relation/_count failed, retrying without counts: ${(error as Error).message}`,
      );
      if (this.isMissingColumnError(error)) {
        const [data, total] = await Promise.all([
          this.prisma.agent.findMany({
            where,
            skip,
            take: limit,
            orderBy: { createdAt: 'desc' },
            select: this.driftSafeAgentSelect,
          }),
          this.prisma.agent.count({ where }),
        ]);
        return {
          data,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        };
      }
      throw error;
    }
  }

  async findOne(id: string, tenantId: string): Promise<unknown> {
    const agent = await this.prisma.agent.findFirst({
      where: { id, tenantId },
      include: {
        _count: {
          select: { tasks: true, memoryEntries: true, executionLogs: true },
        },
      },
    });
    if (!agent) throw new NotFoundException(`Agent ${id} not found`);
    return agent;
  }

  async create(
    input: CreateAgentInput,
    userId: string,
    tenantId: string,
  ): Promise<unknown> {
    return this.prisma.agent.create({
      data: {
        name: input.name,
        description: input.description,
        type: (input.type as AgentType) ?? 'FUNCTIONAL',
        model: input.model ?? 'gpt-4o-mini',
        systemPrompt: input.systemPrompt,
        instructions: input.instructions,
        budgetPerDay: input.budgetPerDay,
        permissions: (input.permissions ?? []) as never,
        config: (input.config ?? {}) as never,
        metadata: (input.metadata ?? {}) as never,
        tenantId,
        createdById: userId,
      },
    });
  }

  async update(
    id: string,
    input: UpdateAgentInput,
    tenantId: string,
  ): Promise<unknown> {
    await this.assertOwnership(id, tenantId);
    return this.prisma.agent.update({
      where: { id },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.status && { status: input.status }),
        ...(input.model && { model: input.model }),
        ...(input.systemPrompt !== undefined && {
          systemPrompt: input.systemPrompt,
        }),
        ...(input.instructions !== undefined && {
          instructions: input.instructions,
        }),
        ...(input.budgetPerDay !== undefined && {
          budgetPerDay: input.budgetPerDay,
        }),
        ...(input.permissions && { permissions: input.permissions as never }),
        ...(input.config && { config: input.config as never }),
        ...(input.metadata && { metadata: input.metadata as never }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
        ...(input.emailAlias !== undefined && { emailAlias: input.emailAlias }),
        ...(input.emailProvider !== undefined && {
          emailProvider: input.emailProvider,
        }),
        ...(input.emailDisplayName !== undefined && {
          emailDisplayName: input.emailDisplayName,
        }),
        ...(input.emailSignature !== undefined && {
          emailSignature: input.emailSignature,
        }),
        ...(input.googleDriveFolderId !== undefined && {
          googleDriveFolderId: input.googleDriveFolderId,
        }),
      },
    });
  }

  async remove(id: string, tenantId: string): Promise<void> {
    await this.assertOwnership(id, tenantId);
    await this.prisma.agent.delete({ where: { id } });
    this.logger.log(`Agent ${id} deleted`);
  }

  async updateStatus(
    id: string,
    status: AgentStatus,
    tenantId: string,
  ): Promise<unknown> {
    await this.assertOwnership(id, tenantId);
    const agent = await this.prisma.agent.update({
      where: { id },
      data: { status },
    });
    this.events.emitAgentStatusUpdated(tenantId, id, status);
    return agent;
  }

  async setStatus(
    id: string,
    status: AgentStatus,
    tenantId: string,
  ): Promise<unknown> {
    await this.assertOwnership(id, tenantId);
    const agent = await this.prisma.agent.update({
      where: { id },
      data: { status },
    });
    this.events.emitAgentStatusUpdated(tenantId, id, status);
    this.logger.log(
      `Agent ${id} (tenant ${tenantId}) status set to ${status}`,
    );
    return agent;
  }

  private async assertOwnership(id: string, tenantId: string): Promise<void> {
    const exists = await this.prisma.agent.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) throw new NotFoundException(`Agent ${id} not found`);
  }

  private isMissingColumnError(error: unknown): boolean {
    if (!(error instanceof Error)) return false;
    const code = error as { code?: string };
    return code.code === 'P2022' || error.message.includes('does not exist');
  }
}
