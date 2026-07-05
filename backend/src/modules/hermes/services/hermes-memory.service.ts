import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EmbeddingsService } from '../../knowledge/services/embeddings.service';

/**
 * HermesMemoryService — long-term memory for HermesAgent executions.
 *
 * H7: when an `EmbeddingsService` is wired (and `OPENAI_API_KEY` is set),
 * `store()` and `summarize()` populate `HermesMemoryEntry.embedding` with
 * a 1536-dim OpenAI vector for downstream semantic recall. If embeddings
 * are unavailable the column is left empty — the existing BM25-style
 * `getContext()` fallback continues to work.
 */
@Injectable()
export class HermesMemoryService {
  private readonly logger = new Logger(HermesMemoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly embeddings?: EmbeddingsService,
  ) {}

  async store(params: {
    hermesAgentId: string;
    tenantId: string;
    type: 'PERSONAL' | 'EPISODIC' | 'PROCEDURAL';
    content: string;
    importance?: number;
    source?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const embedding = await this.tryEmbed(params.content);
    await this.prisma.hermesMemoryEntry.create({
      data: {
        hermesAgentId: params.hermesAgentId,
        tenantId: params.tenantId,
        type: params.type,
        content: params.content,
        importance: params.importance ?? 0.5,
        source: params.source ?? null,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: (params.metadata as any) ?? undefined,
        embedding: embedding ?? [],
      },
    });
  }

  async getContext(hermesAgentId: string, tenantId: string): Promise<string> {
    const entries = await this.prisma.hermesMemoryEntry.findMany({
      where: { hermesAgentId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { type: true, content: true, summary: true, importance: true },
    });

    if (entries.length === 0) return '';

    return entries
      .map(
        (e) =>
          `[${e.type}${e.importance && e.importance >= 0.8 ? ' (important)' : ''}]: ${e.summary ?? e.content.substring(0, 200)}`,
      )
      .join('\n');
  }

  async summarize(
    hermesAgentId: string,
    content: string,
    tenantId: string,
  ): Promise<void> {
    const summary =
      content.length > 500 ? content.substring(0, 497) + '...' : content;
    const embedding = await this.tryEmbed(summary);
    await this.prisma.hermesMemoryEntry.create({
      data: {
        hermesAgentId,
        tenantId,
        type: 'EPISODIC',
        content,
        summary,
        importance: 0.3,
        embedding: embedding ?? [],
      },
    });
  }

  /** Best-effort embedding; logs and returns null on any failure. */
  private async tryEmbed(text: string): Promise<number[] | null> {
    if (!this.embeddings) return null;
    try {
      return await this.embeddings.embedQuery(text);
    } catch (err) {
      this.logger.warn(
        `Embedding failed for ${text.length}-char input — storing without vector: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
      return null;
    }
  }
}
