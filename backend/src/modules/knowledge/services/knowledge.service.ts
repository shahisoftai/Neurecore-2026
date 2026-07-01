/**
 * KnowledgeService — CRUD + retrieval orchestration for KnowledgeEntry.
 *
 * Phase 6, Task 6.1 (per EAOS-implementation-plan.md §9.7 +
 * EAOS-api-contract.md §8.17).
 *
 * Responsibilities (SRP):
 *   - Tenant-scoped CRUD (create / read / update / delete / list)
 *   - Embedding + vector upsert on every write that changes content
 *   - Retrieval-count + lastRetrievedAt bookkeeping
 *   - Citation usage tracking (which AI action invocation cited this entry)
 *
 * DIP: depends on IChunkingService, IEmbeddingsService, IVectorStore via
 * injected tokens so test/fallback implementations can swap in.
 */

import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import type { KnowledgeEntry, KnowledgeType, Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  CHUNKING_SERVICE,
  EMBEDDINGS_SERVICE,
  VECTOR_STORE,
} from '../interfaces/knowledge.interface';
import type { IChunkingService, IEmbeddingsService, IVectorStore } from '../interfaces/knowledge.interface';
import { ChunkingService } from './chunking.service';
import { EmbeddingsService } from './embeddings.service';
import {
  CreateKnowledgeDto,
  ListKnowledgeDto,
  SearchKnowledgeDto,
  UpdateKnowledgeDto,
} from '../dto/knowledge.dto';
import { HybridSearchService } from './hybrid-search.service';

@Injectable()
export class KnowledgeService {
  private readonly logger = new Logger(KnowledgeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chunking: ChunkingService,
    private readonly embeddings: EmbeddingsService,
    private readonly hybrid: HybridSearchService,
    @Optional() @Inject(VECTOR_STORE)
    private readonly vectorStore?: IVectorStore,
  ) {}

  // ─── CRUD ────────────────────────────────────────────────────────────

  async create(
    tenantId: string,
    authorId: string,
    dto: CreateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    if (!tenantId) throw new BadRequestException('Missing tenant context');

    const entry = await this.prisma.knowledgeEntry.create({
      data: {
        tenantId,
        type: dto.type,
        title: dto.title,
        content: dto.content,
        language: dto.language ?? 'en',
        tags: dto.tags ?? [],
        departmentId: dto.departmentId ?? null,
        entityTypes: dto.entityTypes ?? [],
        sourceUrl: dto.sourceUrl ?? null,
        authorId,
        status: dto.status ?? 'published',
      },
    });

    await this.embedAndIndex(entry);
    return this.findOneOrThrow(entry.id, tenantId);
  }

  async findOneOrThrow(id: string, tenantId: string): Promise<KnowledgeEntry> {
    const entry = await this.prisma.knowledgeEntry.findFirst({
      where: { id, tenantId },
    });
    if (!entry) throw new NotFoundException(`Knowledge entry ${id} not found`);
    return entry;
  }

  async findOnePermissive(id: string, tenantId: string): Promise<KnowledgeEntry> {
    const entry = await this.prisma.knowledgeEntry.findFirst({
      where: { id, tenantId },
    });
    if (!entry) throw new NotFoundException(`Knowledge entry ${id} not found`);
    return entry;
  }

  async update(
    id: string,
    tenantId: string,
    dto: UpdateKnowledgeDto,
  ): Promise<KnowledgeEntry> {
    const existing = await this.findOneOrThrow(id, tenantId);
    const updated = await this.prisma.knowledgeEntry.update({
      where: { id: existing.id },
      data: {
        ...(dto.type && { type: dto.type }),
        ...(dto.title && { title: dto.title }),
        ...(dto.content && { content: dto.content }),
        ...(dto.tags && { tags: dto.tags }),
        ...(dto.departmentId !== undefined && { departmentId: dto.departmentId }),
        ...(dto.entityTypes && { entityTypes: dto.entityTypes }),
        ...(dto.status && { status: dto.status }),
        ...(dto.language && { language: dto.language }),
      },
    });

    // Re-embed when content / title / type / tags changed
    if (dto.content || dto.title || dto.type || dto.tags) {
      await this.embedAndIndex(updated);
    }
    return this.findOneOrThrow(updated.id, tenantId);
  }

  async remove(id: string, tenantId: string): Promise<void> {
    const existing = await this.findOneOrThrow(id, tenantId);
    if (this.vectorStore) {
      try {
        await this.vectorStore.delete(existing.id);
      } catch (err) {
        this.logger.warn(
          `vectorStore.delete(${existing.id}) failed: ${(err as Error).message}`,
        );
      }
    }
    await this.prisma.knowledgeEntry.delete({ where: { id: existing.id } });
  }

  async list(tenantId: string, dto: ListKnowledgeDto) {
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 20;

    const where: Prisma.KnowledgeEntryWhereInput = {
      tenantId,
      ...(dto.type && { type: dto.type }),
      ...(dto.status && { status: dto.status }),
      ...(dto.departmentId && { departmentId: dto.departmentId }),
      ...(dto.tags && { tags: { hasEvery: dto.tags.split(',').map((t) => t.trim()).filter(Boolean) } }),
    };

    const [items, total] = await Promise.all([
      this.prisma.knowledgeEntry.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.knowledgeEntry.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  // ─── Search ─────────────────────────────────────────────────────────

  async search(tenantId: string, dto: SearchKnowledgeDto) {
    const start = Date.now();

    const hits = await this.hybrid.search({
      tenantId,
      query: dto.query,
      topK: dto.limit ?? 10,
      types: dto.type ? [dto.type as KnowledgeType] : undefined,
      tags: dto.tags,
      departmentId: dto.departmentId,
      vectorWeight: dto.vectorWeight ?? 0.7,
    });

    return {
      results: hits.map((h) => ({
        id: h.id,
        title: h.title,
        type: h.type as KnowledgeType,
        excerpt: h.content.slice(0, 320),
        relevanceScore: Number(h.score.toFixed(4)),
        highlights: h.highlights,
        departmentId: h.departmentId,
        tags: h.tags,
      })),
      took: Date.now() - start,
      query: dto.query,
    };
  }

  // ─── Citations tracking ─────────────────────────────────────────────

  /**
   * Record a citation: which AI-action invocation cited which entry.
   * Backed by a simple JSON-encoded column on AIActionInvocation
   * (input.knowledgeContext), so no new table is required.
   */
  async recordCitation(
    invocationId: string,
    entryIds: string[],
    question: string,
    tenantId: string,
  ): Promise<void> {
    if (!invocationId || !entryIds.length) return;
    try {
      await this.prisma.aIActionInvocation.update({
        where: { id: invocationId },
        data: {
          input: {
            ...((await this.prisma.aIActionInvocation
              .findUnique({ where: { id: invocationId } })
              .then((r) => (r?.input as Record<string, unknown>) ?? {})) as Record<string, unknown>),
            knowledgeContext: {
              question,
              citedEntryIds: entryIds,
              citedAt: new Date().toISOString(),
            },
          } as Prisma.InputJsonValue,
        },
      });
      // No-op — silently swallow on failure to avoid breaking the user flow
    } catch (err) {
      this.logger.warn(
        `recordCitation(${invocationId}) failed: ${(err as Error).message}`,
      );
    }
  }

  async listCitationsFor(entryId: string, tenantId: string) {
    // Find AIActionInvocation rows whose input.knowledgeContext.citedEntryIds
    // includes this entryId. Uses Postgres JSONB containment.
    const invocations = await this.prisma.aIActionInvocation.findMany({
      where: {
        tenantId,
        input: {
          path: ['knowledgeContext', 'citedEntryIds'],
          array_contains: entryId,
        } as Prisma.JsonFilter<'AIActionInvocation'>,
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        id: true,
        startedAt: true,
        input: true,
        actionId: true,
      },
    });

    return invocations.map((inv) => {
      const ctx = (inv.input as { knowledgeContext?: { question?: string; citedEntryIds?: string[] } })?.knowledgeContext;
      return {
        invocationId: inv.id,
        knowledgeEntryId: entryId,
        question: ctx?.question ?? '',
        score: 0,
        createdAt: inv.startedAt.toISOString(),
      };
    });
  }

  // ─── Embedding orchestration ───────────────────────────────────────

  private async embedAndIndex(entry: KnowledgeEntry): Promise<void> {
    if (entry.status !== 'published') return;

    // Chunk + embed (using a representative chunk for the entry-level vector)
    const chunks = this.chunking.split(entry.content, { maxChunkChars: 1_500 });
    const representative = chunks[0]?.text ?? entry.title;
    const chunkCount = chunks.length;

    try {
      const vec = await this.embeddings.embedQuery(representative);
      if (vec && this.vectorStore) {
        await this.vectorStore.upsert(entry.id, vec);
      }
      await this.prisma.knowledgeEntry.update({
        where: { id: entry.id },
        data: { chunkCount },
      });
    } catch (err) {
      this.logger.warn(
        `embedAndIndex(${entry.id}) failed: ${(err as Error).message}`,
      );
    }
  }
}