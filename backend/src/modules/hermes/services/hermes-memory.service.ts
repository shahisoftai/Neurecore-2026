import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConfigService } from '@nestjs/config';
import type {
  IHermesMemory,
  StoreMemoryInput,
  HermesMemoryEntryDescriptor,
  HermesMemoryStats,
  MemorySearchOpts,
} from '../interfaces/hermes-memory.interface';
import type { HermesMemoryType } from '@prisma/client';

@Injectable()
export class HermesMemoryService implements IHermesMemory {
  private readonly logger = new Logger(HermesMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async store(
    input: StoreMemoryInput,
    tenantId: string,
  ): Promise<HermesMemoryEntryDescriptor> {
    const embedding = await this.generateEmbedding(input.content);

    const entry = await this.prisma.hermesMemoryEntry.create({
      data: {
        hermesAgentId: input.hermesAgentId,
        tenantId,
        workspaceId: input.workspaceId,
        type: input.type,
        content: input.content,
        summary: input.summary,
        embedding: embedding ?? [],
        importance: input.importance ?? 0.5,
        source: input.source,
        metadata: (input.metadata ?? {}) as never,
        expiresAt: input.expiresAt,
      },
    });

    return this.toDescriptor(entry);
  }

  async search(
    agentId: string,
    query: string,
    tenantId: string,
    opts?: MemorySearchOpts,
  ): Promise<HermesMemoryEntryDescriptor[]> {
    const { type, limit = 10, minImportance, workspaceId } = opts ?? {};

    const queryEmbedding = await this.generateEmbedding(query);

    const where = {
      hermesAgentId: agentId,
      tenantId,
      ...(type && { type }),
      ...(workspaceId && { workspaceId }),
      ...(minImportance !== undefined && {
        importance: { gte: minImportance },
      }),
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    };

    if (!queryEmbedding) {
      const entries = await this.prisma.hermesMemoryEntry.findMany({
        where,
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        take: limit,
      });
      return entries.map((e) => this.toDescriptor(e));
    }

    const candidates = await this.prisma.hermesMemoryEntry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit * 5,
    });

    const scored = candidates
      .filter((e) => e.embedding && e.embedding.length > 0)
      .map((entry) => {
        const sim = this.cosineSimilarity(queryEmbedding, entry.embedding);
        return { entry, score: sim };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return scored.map((s) => this.toDescriptor(s.entry));
  }

  async getContext(
    agentId: string,
    tenantId: string,
    limit = 5,
  ): Promise<string> {
    const entries = await this.prisma.hermesMemoryEntry.findMany({
      where: {
        hermesAgentId: agentId,
        tenantId,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
      take: limit,
    });

    if (entries.length === 0) return '';

    return entries
      .map((e) => `[${e.type}] ${e.summary ?? e.content.slice(0, 200)}`)
      .join('\n\n');
  }

  async rememberEpisode(
    agentId: string,
    tenantId: string,
    episode: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    await this.store(
      {
        hermesAgentId: agentId,
        type: 'EPISODIC',
        content: episode,
        summary: episode.slice(0, 100),
        importance: 0.8,
        source: 'episode',
        metadata,
      },
      tenantId,
    );
  }

  async forget(
    agentId: string,
    memoryId: string,
    tenantId: string,
  ): Promise<void> {
    const entry = await this.prisma.hermesMemoryEntry.findFirst({
      where: { id: memoryId, hermesAgentId: agentId, tenantId },
    });
    if (!entry) return;
    await this.prisma.hermesMemoryEntry.delete({ where: { id: memoryId } });
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
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { importance: 'desc' },
      take: 3,
    });

    for (const entry of entries) {
      if (entry.content.toLowerCase().includes(task.toLowerCase())) {
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
    await this.store(
      {
        hermesAgentId: agentId,
        type: 'PROCEDURAL',
        content: `Task: ${task}\n\nProcedure:\n${procedure}`,
        summary: `Procedure for: ${task}`,
        importance: 0.9,
        source: 'procedural',
      },
      tenantId,
    );
  }

  async getStats(
    agentId: string,
    tenantId: string,
  ): Promise<HermesMemoryStats> {
    const [counts, oldest, newest] = await Promise.all([
      this.prisma.hermesMemoryEntry.groupBy({
        by: ['type'],
        where: { hermesAgentId: agentId, tenantId },
        _count: true,
      }),
      this.prisma.hermesMemoryEntry.findFirst({
        where: { hermesAgentId: agentId, tenantId },
        orderBy: { createdAt: 'asc' },
        select: { createdAt: true },
      }),
      this.prisma.hermesMemoryEntry.findFirst({
        where: { hermesAgentId: agentId, tenantId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);

    const map: Record<string, number> = {};
    for (const c of counts) {
      map[c.type.toLowerCase()] = c._count;
    }

    return {
      personal: map['personal'] ?? 0,
      episodic: map['episodic'] ?? 0,
      procedural: map['procedural'] ?? 0,
      total: Object.values(map).reduce((a, b) => a + b, 0),
      oldestEntry: oldest?.createdAt,
      newestEntry: newest?.createdAt,
    };
  }

  async purgeExpired(tenantId?: string): Promise<number> {
    const result = await this.prisma.hermesMemoryEntry.deleteMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        expiresAt: { lt: new Date() },
      },
    });
    this.logger.log(`[HermesMemory] Purged ${result.count} expired entries`);
    return result.count;
  }

  private async generateEmbedding(text: string): Promise<number[] | null> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) return null;

    try {
      const { OpenAIEmbeddings } = await import('@langchain/openai');
      const embeddings = new OpenAIEmbeddings({
        apiKey,
        model: 'text-embedding-3-small',
      });
      return await embeddings.embedQuery(text);
    } catch (err) {
      this.logger.warn(`Embedding failed: ${String(err)}`);
      return null;
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length || a.length === 0) return 0;
    let dot = 0,
      normA = 0,
      normB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-10);
  }

  private toDescriptor(entry: {
    id: string;
    hermesAgentId: string;
    tenantId: string;
    workspaceId: string | null;
    type: HermesMemoryType;
    content: string;
    summary: string | null;
    importance: number;
    source: string | null;
    metadata: unknown;
    expiresAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): HermesMemoryEntryDescriptor {
    return {
      id: entry.id,
      hermesAgentId: entry.hermesAgentId,
      tenantId: entry.tenantId,
      workspaceId: entry.workspaceId ?? undefined,
      type: entry.type,
      content: entry.content,
      summary: entry.summary ?? undefined,
      importance: entry.importance,
      source: entry.source ?? undefined,
      metadata: entry.metadata as Record<string, unknown>,
      expiresAt: entry.expiresAt ?? undefined,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
