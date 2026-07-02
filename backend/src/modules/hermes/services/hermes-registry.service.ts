import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';
import type {
  HermesAgentDescriptor,
  HermesCapabilityDescriptor,
  CreateHermesAgentInput,
  UpdateHermesAgentInput,
} from '../interfaces/hermes-agent.interface';
import type {
  HermesAgentHealth,
  PaginatedResult,
  CreateCapabilityInput,
  ToolPermissionInput,
  FindAllOpts,
} from '../interfaces/hermes-registry.interface';
import type { HermesAgentType, HermesAgentStatus } from '@prisma/client';
import { DEFAULT_MAX_FILE_SIZE } from '../common/hermes.types';

@Injectable()
export class HermesRegistryService {
  private readonly logger = new Logger(HermesRegistryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async register(
    input: CreateHermesAgentInput,
    tenantId: string,
  ): Promise<HermesAgentDescriptor> {
    const agent = await this.prisma.hermesAgent.create({
      data: {
        name: input.name,
        type: input.type,
        description: input.description,
        model: input.model,
        systemPrompt: input.systemPrompt,
        permissions: input.permissions ?? [],
        allowedPaths: input.allowedPaths ?? [],
        blockedPaths: input.blockedPaths ?? [],
        maxFileSize: input.maxFileSize ?? DEFAULT_MAX_FILE_SIZE,
        config: (input.config ?? {}) as Prisma.InputJsonValue,
        workspaceId: input.workspaceId,
        isActive: input.isActive ?? true,
        tenantId,
      },
    });

    this.logger.log(
      `[HermesRegistry] Registered agent ${agent.id} (${agent.name}) for tenant ${tenantId}`,
    );
    return this.toDescriptor(agent);
  }

  async findById(
    id: string,
    tenantId: string,
  ): Promise<HermesAgentDescriptor | null> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id, tenantId },
      include: { capabilities: true, toolPermissions: true },
    });
    return agent ? this.toDescriptor(agent) : null;
  }

  async findByType(
    type: HermesAgentType,
    tenantId: string,
  ): Promise<HermesAgentDescriptor[]> {
    const agents = await this.prisma.hermesAgent.findMany({
      where: { type, tenantId },
      include: { capabilities: true, toolPermissions: true },
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(agents.map((a) => this.toDescriptor(a)));
  }

  async findByCapability(
    capability: string,
    tenantId: string,
  ): Promise<HermesAgentDescriptor[]> {
    const agents = await this.prisma.hermesAgent.findMany({
      where: {
        tenantId,
        isActive: true,
        capabilities: {
          some: { name: { equals: capability, mode: 'insensitive' } },
        },
      },
      include: { capabilities: true, toolPermissions: true },
    });
    return Promise.all(agents.map((a) => this.toDescriptor(a)));
  }

  async findAll(
    tenantId: string,
    opts?: FindAllOpts,
  ): Promise<PaginatedResult<HermesAgentDescriptor>> {
    const { page = 1, limit = 20, status, type, isActive } = opts ?? {};
    const skip = (page - 1) * limit;

    const where = {
      tenantId,
      ...(status && { status }),
      ...(type && { type }),
      ...(isActive !== undefined && { isActive }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.hermesAgent.findMany({
        where,
        skip,
        take: limit,
        include: { capabilities: true, toolPermissions: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.hermesAgent.count({ where }),
    ]);

    const descriptors = await Promise.all(
      data.map((a) => this.toDescriptor(a)),
    );

    return {
      data: descriptors,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async update(
    agentId: string,
    input: Partial<UpdateHermesAgentInput>,
    tenantId: string,
  ): Promise<HermesAgentDescriptor> {
    await this.assertAgentExists(agentId, tenantId);

    const updated = await this.prisma.hermesAgent.update({
      where: { id: agentId },
      data: {
        ...(input.name && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.model !== undefined && { model: input.model }),
        ...(input.systemPrompt !== undefined && {
          systemPrompt: input.systemPrompt,
        }),
        ...(input.permissions !== undefined && {
          permissions: input.permissions,
        }),
        ...(input.allowedPaths !== undefined && {
          allowedPaths: input.allowedPaths,
        }),
        ...(input.blockedPaths !== undefined && {
          blockedPaths: input.blockedPaths,
        }),
        ...(input.maxFileSize !== undefined && {
          maxFileSize: input.maxFileSize,
        }),
        ...(input.config !== undefined && {
          config: input.config as Prisma.InputJsonValue,
        }),
        ...(input.isActive !== undefined && { isActive: input.isActive }),
      },
      include: { capabilities: true, toolPermissions: true },
    });

    return this.toDescriptor(updated);
  }

  async unregister(agentId: string, tenantId: string): Promise<void> {
    await this.assertAgentExists(agentId, tenantId);
    await this.prisma.hermesAgent.delete({ where: { id: agentId } });
    this.logger.log(`[HermesRegistry] Unregistered agent ${agentId}`);
  }

  async archive(id: string, tenantId: string): Promise<void> {
    await this.assertAgentExists(id, tenantId);
    await this.prisma.hermesAgent.update({
      where: { id },
      data: { isActive: false, status: 'SUSPENDED' as HermesAgentStatus },
    });
  }

  async updateStatus(
    id: string,
    status: HermesAgentStatus,
    tenantId: string,
  ): Promise<HermesAgentDescriptor> {
    await this.assertAgentExists(id, tenantId);
    const updated = await this.prisma.hermesAgent.update({
      where: { id },
      data: { status },
      include: { capabilities: true, toolPermissions: true },
    });
    return this.toDescriptor(updated);
  }

  async addCapability(
    agentId: string,
    input: CreateCapabilityInput,
    tenantId: string,
  ): Promise<HermesCapabilityDescriptor> {
    await this.assertAgentExists(agentId, tenantId);

    const cap = await this.prisma.hermesCapability.create({
      data: {
        hermesAgentId: agentId,
        name: input.name,
        description: input.description,
        inputSchema: (input.inputSchema ?? {}) as Prisma.InputJsonValue,
        outputSchema: (input.outputSchema ?? {}) as Prisma.InputJsonValue,
        costEstimate: input.costEstimate,
        avgDuration: input.avgDuration,
      },
    });

    return this.toCapabilityDescriptor(cap);
  }

  async removeCapability(
    agentId: string,
    capabilityId: string,
    tenantId: string,
  ): Promise<void> {
    await this.assertAgentExists(agentId, tenantId);
    await this.prisma.hermesCapability.deleteMany({
      where: { id: capabilityId, hermesAgentId: agentId },
    });
  }

  async setToolPermissions(
    agentId: string,
    permissions: ToolPermissionInput[],
    tenantId: string,
  ): Promise<void> {
    await this.assertAgentExists(agentId, tenantId);

    await this.prisma.$transaction(async (tx) => {
      await tx.hermesToolPermission.deleteMany({
        where: { hermesAgentId: agentId },
      });

      if (permissions.length > 0) {
        await tx.hermesToolPermission.createMany({
          data: permissions.map((p) => ({
            hermesAgentId: agentId,
            toolName: p.toolName,
            permission: p.permission as
              | 'ALLOW'
              | 'DENY'
              | 'READ_ONLY'
              | 'WRITE_ONLY'
              | 'APPROVAL_REQUIRED',
            conditions: (p.conditions ?? {}) as Prisma.InputJsonValue,
          })),
        });
      }
    });

    this.logger.log(
      `[HermesRegistry] Set ${permissions.length} tool permissions for agent ${agentId}`,
    );
  }

  async recordUsage(
    agentId: string,
    capability: string,
    cost: number,
    duration: number,
  ): Promise<void> {
    await this.prisma.hermesCapability.updateMany({
      where: { hermesAgentId: agentId, name: capability },
      data: {
        usageCount: { increment: 1 },
        ...(cost > 0 && { costEstimate: cost }),
        ...(duration > 0 && { avgDuration: duration }),
      },
    });
  }

  async getHealth(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentHealth> {
    await this.assertAgentExists(agentId, tenantId);

    const [memoryCounts, auditLogs] = await Promise.all([
      this.prisma.hermesMemoryEntry.groupBy({
        by: ['type'],
        where: { hermesAgentId: agentId, tenantId },
        _count: true,
      }),
      this.prisma.hermesAuditLog.aggregate({
        where: { hermesAgentId: agentId, tenantId },
        _count: true,
      }),
    ]);

    const memoryMap: Record<string, number> = {};
    for (const m of memoryCounts) {
      memoryMap[m.type.toLowerCase()] = m._count;
    }

    const agent = await this.prisma.hermesAgent.findUnique({
      where: { id: agentId },
      select: { status: true, maxFileSize: true },
    });

    return {
      agentId,
      status: agent!.status,
      totalRequests: auditLogs._count,
      avgResponseTime: 0,
      successRate: 1.0,
      dailyCost: 0,
      dailyLimit: agent!.maxFileSize,
      memoryUsage: {
        personal: memoryMap['personal'] ?? 0,
        episodic: memoryMap['episodic'] ?? 0,
        procedural: memoryMap['procedural'] ?? 0,
      },
    };
  }

  private async assertAgentExists(id: string, tenantId: string): Promise<void> {
    const exists = await this.prisma.hermesAgent.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(
        `HermesAgent ${id} not found for tenant ${tenantId}`,
      );
    }
  }

  private toDescriptor(
    agent: Awaited<ReturnType<PrismaService['hermesAgent']['findFirst']>>,
  ): HermesAgentDescriptor {
    if (!agent) throw new NotFoundException('Agent not found');
    const a = agent as Record<string, unknown>;
    return {
      id: a['id'] as string,
      name: a['name'] as string,
      type: a['type'] as HermesAgentType,
      status: a['status'] as HermesAgentStatus,
      description: (a['description'] as string) ?? undefined,
      model: (a['model'] as string) ?? undefined,
      systemPrompt: (a['systemPrompt'] as string) ?? undefined,
      isActive: a['isActive'] as boolean,
      tenantId: a['tenantId'] as string,
      workspaceId: (a['workspaceId'] as string) ?? undefined,
      permissions: (a['permissions'] as string[]) ?? [],
      allowedPaths: (a['allowedPaths'] as string[]) ?? [],
      blockedPaths: (a['blockedPaths'] as string[]) ?? [],
      maxFileSize: a['maxFileSize'] as number,
      config: (a['config'] as Record<string, unknown>) ?? {},
      createdAt: a['createdAt'] as Date,
      updatedAt: a['updatedAt'] as Date,
    };
  }

  private toCapabilityDescriptor(
    cap: Record<string, unknown>,
  ): HermesCapabilityDescriptor {
    return {
      id: cap['id'] as string,
      hermesAgentId: cap['hermesAgentId'] as string,
      name: cap['name'] as string,
      description: (cap['description'] as string) ?? undefined,
      inputSchema: (cap['inputSchema'] as Record<string, unknown>) ?? undefined,
      outputSchema:
        (cap['outputSchema'] as Record<string, unknown>) ?? undefined,
      costEstimate: (cap['costEstimate'] as number) ?? undefined,
      avgDuration: (cap['avgDuration'] as number) ?? undefined,
      usageCount: (cap['usageCount'] as number) ?? 0,
    };
  }
}
