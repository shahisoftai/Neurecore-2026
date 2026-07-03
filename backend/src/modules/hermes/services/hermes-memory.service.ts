import { Injectable, Logger } from '@nestjs/common';
import type { HermesMemoryEntry } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IHermesMemory } from '../interfaces/hermes-memory.interface';
import type {
  HermesMemoryInput,
  MemorySearchOptions,
} from '../interfaces/hermes-memory.interface';
import {
  HERMES_MEMORY_DEFAULT_LIMIT,
} from '../common/hermes.constants';
import { parseMemoryContext } from '../common/hermes.utils';

@Injectable()
export class HermesMemoryService implements IHermesMemory {
  private readonly logger = new Logger(HermesMemoryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async store(
    input: HermesMemoryInput,
  ): Promise<HermesMemoryEntry> {
    const embedding: number[] = []; // Will use actual embeddings in production — placeholder for MVP

    const entry = await this.prisma.hermesMemoryEntry.create({
      data: {
        hermesAgentId: input.hermesAgentId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        type: input.type,
        content: input.content,
        summary: input.summary,
        embedding,
        importance: input.importance ?? 0.5,
        source: input.source,
        metadata: input.metadata as any,
        expiresAt: input.expiresAt,
      },
    });

    this.logger.debug(
      `Stored ${input.type} memory for agent ${input.hermesAgentId}: ${entry.id}`,
    );

    return entry;
  }

  async search(
    agentId: string,
    query: string,
    tenantId: string,
    options: MemorySearchOptions = {},
  ): Promise<HermesMemoryEntry[]> {
    const limit = options.limit ?? HERMES_MEMORY_DEFAULT_LIMIT;
    const minImportance = options.minImportance ?? 0;

    const where: any = {
      hermesAgentId: agentId,
      tenantId,
      importance: { gte: minImportance },
    };

    if (options.type) {
      where.type = options.type;
    }

    const entries = await this.prisma.hermesMemoryEntry.findMany({
      where,
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: limit * 2,
    });

    const results = entries.filter((entry) => {
      if (!entry.content) return false;
      return (
        entry.content
          .toLowerCase()
          .includes(query.toLowerCase()) ||
        (entry.summary ?? '')
          .toLowerCase()
          .includes(query.toLowerCase()) ||
        (entry.source ?? '')
          .toLowerCase()
          .includes(query.toLowerCase())
      );
    });

    return results.slice(0, limit);
  }

  async getContext(
    agentId: string,
    tenantId: string,
    limit = 15,
  ): Promise<string> {
    const entries = await this.prisma.hermesMemoryEntry.findMany({
      where: { hermesAgentId: agentId, tenantId },
      orderBy: [{ importance: 'desc' }, { updatedAt: 'desc' }],
      take: limit * 2,
      select: {
        content: true,
        summary: true,
        type: true,
        importance: true,
      },
    });

    return parseMemoryContext(entries, 4000);
  }

  async rememberEpisode(
    agentId: string,
    tenantId: string,
    episode: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.store({
      hermesAgentId: agentId,
      tenantId,
      type: 'EPISODIC',
      content: episode,
      importance: 0.7,
      metadata,
    });
  }

  async forget(
    agentId: string,
    memoryId: string,
    tenantId: string,
  ): Promise<void> {
    await this.prisma.hermesMemoryEntry.deleteMany({
      where: {
        id: memoryId,
        hermesAgentId: agentId,
        tenantId,
      },
    });

    this.logger.debug(
      `Deleted memory entry ${memoryId} for agent ${agentId}`,
    );
  }

  async getProceduralMemory(
    agentId: string,
    task: string,
    tenantId: string,
  ): Promise<string | null> {
    const entries = await this.prisma.hermesMemoryEntry.findMany({
      where: {
        hermesAgentId: agentId,
        tenantId,
        type: 'PROCEDURAL',
      },
      orderBy: { importance: 'desc' },
      take: 20,
    });

    const taskLower = task.toLowerCase();

    for (const entry of entries) {
      if (
        entry.content &&
        entry.content.toLowerCase().includes(taskLower)
      ) {
        return entry.content;
      }
    }

    return null;
  }

  async storeProceduralMemory(
    agentId: string,
    tenantId: string,
    task: string,
    procedure: string,
  ): Promise<void> {
    await this.store({
      hermesAgentId: agentId,
      tenantId,
      type: 'PROCEDURAL',
      content: `Task: ${task}\n\n${procedure}`,
      summary: `SOP for: ${task}`,
      importance: 0.8,
    });
  }

  async cleanupExpired(
    tenantId: string,
  ): Promise<number> {
    const result = await this.prisma.hermesMemoryEntry.deleteMany({
      where: {
        tenantId,
        expiresAt: { lt: new Date() },
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Cleaned up ${result.count} expired memory entries in tenant ${tenantId}`,
      );
    }

    return result.count;
  }

  async getMemoryStats(
    agentId: string,
    tenantId: string,
  ): Promise<{
    shortTerm: number;
    longTerm: number;
    episodic: number;
  }> {
    const [personal, procedural, episodic] = await Promise.all([
      this.prisma.hermesMemoryEntry.count({
        where: { hermesAgentId: agentId, tenantId, type: 'PERSONAL' },
      }),
      this.prisma.hermesMemoryEntry.count({
        where: { hermesAgentId: agentId, tenantId, type: 'PROCEDURAL' },
      }),
      this.prisma.hermesMemoryEntry.count({
        where: { hermesAgentId: agentId, tenantId, type: 'EPISODIC' },
      }),
    ]);

    return {
      shortTerm: personal,
      longTerm: procedural,
      episodic,
    };
  }
}
