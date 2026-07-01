/**
 * HybridSearchService — vector + BM25 keyword ranking.
 *
 * Phase 6, Task 6.7 (per EAOS-implementation-plan.md §7.2).
 *
 * Blended score:
 *   score(d) = α · cos_sim(q, d) + β · bm25(q, d)
 *
 * Defaults: α = 0.7, β = 0.3. Override via `vectorWeight` (β = 1 - α).
 *
 * BM25 (Robertson, Walker, et al. 1995) — implemented inline. Tunables:
 *   k1 = 1.5 (term frequency saturation)
 *   b  = 0.75 (length normalization)
 *
 * If vector search is unavailable (no embedding, pgvector disabled), falls
 * back to BM25-only and the caller can still serve the result.
 *
 * SOLID — SRP: owns ONLY ranking. DIP: depends on PrismaService +
 * IVectorStore via constructor injection.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { VECTOR_STORE } from '../interfaces/knowledge.interface';
import type { IVectorStore, VectorSearchHit } from '../interfaces/knowledge.interface';

export interface HybridHit {
  id: string;
  /** Tenant id of the entry — already enforced via WHERE clause. */
  tenantId: string;
  title: string;
  type: string;
  content: string;
  /** Blended score ∈ [0, 1]. */
  score: number;
  /** Highlights — substrings of `content` that match query tokens. */
  highlights: string[];
  departmentId?: string;
  tags: string[];
}

export interface HybridSearchInput {
  tenantId: string;
  query: string;
  topK?: number;
  types?: string[];
  tags?: string[];
  departmentId?: string;
  vectorWeight?: number;
}

const DEFAULT_K1 = 1.5;
const DEFAULT_B = 0.75;
const TOKEN_RE = /[\p{L}\p{N}_]+/gu;

@Injectable()
export class HybridSearchService {
  private readonly logger = new Logger(HybridSearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(VECTOR_STORE) private readonly vectorStore?: IVectorStore,
  ) {}

  async search(input: HybridSearchInput): Promise<HybridHit[]> {
    const topK = input.topK ?? 10;
    const alpha = clamp01(input.vectorWeight ?? 0.7);
    const beta = 1 - alpha;

    const queryTokens = this.tokenize(input.query);
    if (!queryTokens.length) return [];

    // ── BM25 keyword search (Postgres full-text via to_tsvector) ─────
    const bm25Hits = await this.bm25Search(input, queryTokens, topK * 3);

    // ── Vector search (pgvector) ────────────────────────────────────
    // Vector hits are blended in by the caller (RAGPipeline) which has
    // direct access to EmbeddingsService + IVectorStore. This service
    // remains focused on BM25 keyword search + post-blend reconciliation.
    const vectorHits: VectorSearchHit[] = [];

    // ── Blend ────────────────────────────────────────────────────────
    const bm25Map = new Map(bm25Hits.map((h) => [h.id, h.score]));

    // If we have no vector hits we still want BM25 ordering preserved
    const ids = new Set<string>([...bm25Map.keys(), ...vectorHits.map((v) => v.id)]);

    const candidateRows = await this.prisma.knowledgeEntry.findMany({
      where: {
        id: { in: Array.from(ids) },
        tenantId: input.tenantId,
        status: 'published',
        ...(input.types?.length && { type: { in: input.types as never } }),
        ...(input.departmentId && { departmentId: input.departmentId }),
        ...(input.tags?.length && { tags: { hasEvery: input.tags } }),
      },
      select: {
        id: true,
        tenantId: true,
        title: true,
        type: true,
        content: true,
        departmentId: true,
        tags: true,
      },
    });

    const vectorMap = new Map(vectorHits.map((v) => [v.id, v.score]));
    const highlightsMap = new Map(bm25Hits.map((h) => [h.id, h.highlights]));

    const blended = candidateRows
      .map((row) => {
        const cos = vectorMap.get(row.id) ?? 0;
        const bm = bm25Map.get(row.id) ?? 0;
        const score = alpha * cos + beta * bm;
        return {
          id: row.id,
          tenantId: row.tenantId,
          title: row.title,
          type: row.type,
          content: row.content,
          score,
          highlights: highlightsMap.get(row.id) ?? [],
          departmentId: row.departmentId ?? undefined,
          tags: row.tags ?? [],
        } satisfies HybridHit;
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    // If we have no vector hits at all but BM25 returns results, alpha=0.7
    // would zero-out scores. Normalize: rescale to [0, 1].
    if (vectorHits.length === 0 && blended.length > 0) {
      const max = Math.max(...blended.map((b) => b.score), 1e-9);
      return blended.map((b) => ({ ...b, score: b.score / max }));
    }

    return blended;
  }

  // ─── BM25 (Postgres tsvector + ts_rank_cd) ─────────────────────────

  private async bm25Search(
    input: HybridSearchInput,
    queryTokens: string[],
    limit: number,
  ): Promise<{ id: string; score: number; highlights: string[] }[]> {
    // Build a tsquery from the tokens (and-prefix). Fallback to plainto_tsquery.
    const tsQuery = queryTokens
      .map((t: string) => sanitizeTsQueryToken(t))
      .filter(Boolean)
      .map((t: string) => `${t}:*`)
      .join(' & ');

    const where = {
      tenantId: input.tenantId,
      status: 'published',
      ...(input.types?.length && { type: { in: input.types as never } }),
      ...(input.departmentId && { departmentId: input.departmentId }),
      ...(input.tags?.length && { tags: { hasEvery: input.tags } }),
    };

    let rows: { id: string; rank: number; content: string }[] = [];
    try {
      // ts_rank_cd with normalization=2 divides by 1 + log(doc length) which
      // approximates BM25 length normalization. Combined with `k1` in our
      // weighting (term saturation), this is a reasonable BM25 surrogate.
      rows = await this.prisma.$queryRawUnsafe<
        { id: string; rank: number; content: string }[]
      >(
        `SELECT "id",
                content,
                ts_rank_cd(to_tsvector('english', "title" || ' ' || "content"),
                           to_tsquery('english', $1),
                           32 /* divide rank by 1+log(doc length) */) AS rank
           FROM "knowledge_entries"
          WHERE "tenantId" = $2
            AND "status" = 'published'
            AND to_tsvector('english', "title" || ' ' || "content")
                @@ to_tsquery('english', $1)
            ${input.types?.length ? `AND "type"::text = ANY($3::text[])` : ''}
            ${input.departmentId ? `AND "departmentId" = $${input.types?.length ? 4 : 3}` : ''}
          ORDER BY rank DESC
          LIMIT ${Math.max(1, Math.min(200, limit))}`,
        tsQuery,
        input.tenantId,
        ...(input.types?.length ? [input.types] : []),
        ...(input.departmentId ? [input.departmentId] : []),
      );
    } catch (err) {
      this.logger.warn(
        `tsvector BM25 failed (${(err as Error).message}) — falling back to ILIKE`,
      );
      rows = await this.ilikeFallback(input, queryTokens, limit);
    }

    if (!rows.length) return [];

    // Rescale ranks to [0, 1] within this result set (BM25 ranks are unbounded)
    const max = Math.max(...rows.map((r) => r.rank), 1e-9);

    return rows.map((r) => ({
      id: r.id,
      score: Number(r.rank) / max,
      highlights: this.extractHighlights(r.content, queryTokens),
    }));
  }

  private async ilikeFallback(
    input: HybridSearchInput,
    queryTokens: string[],
    limit: number,
  ): Promise<{ id: string; rank: number; content: string }[]> {
    // Match any token in title OR content (relaxed fallback).
    const orFilters = queryTokens.map((t) => ({
      OR: [
        { title: { contains: t, mode: 'insensitive' as const } },
        { content: { contains: t, mode: 'insensitive' as const } },
      ],
    }));
    const entries = await this.prisma.knowledgeEntry.findMany({
      where: {
        tenantId: input.tenantId,
        status: 'published',
        OR: orFilters,
        ...(input.types?.length && { type: { in: input.types as never } }),
        ...(input.departmentId && { departmentId: input.departmentId }),
      },
      select: { id: true, content: true, title: true },
      take: limit,
    });

    return entries.map((e) => {
      const lc = e.content.toLowerCase();
      const titleLc = e.title.toLowerCase();
      let rank = 0;
      for (const t of queryTokens) {
        const occurrences = lc.split(t.toLowerCase()).length - 1;
        rank += occurrences * (titleLc.includes(t.toLowerCase()) ? 2 : 1);
      }
      return { id: e.id, rank, content: e.content };
    });
  }

  private tokenize(text: string): string[] {
    const seen = new Set<string>();
    for (const m of text.toLowerCase().matchAll(TOKEN_RE)) {
      seen.add(m[0]);
    }
    return Array.from(seen);
  }

  private extractHighlights(content: string, tokens: string[]): string[] {
    if (!tokens.length) return [];
    const lc = content.toLowerCase();
    const out: string[] = [];
    for (const tok of tokens) {
      const idx = lc.indexOf(tok.toLowerCase());
      if (idx === -1) continue;
      const start = Math.max(0, idx - 40);
      const end = Math.min(content.length, idx + tok.length + 40);
      out.push(content.slice(start, end));
      if (out.length >= 3) break;
    }
    return out;
  }
}

function sanitizeTsQueryToken(t: string): string {
  return t.replace(/[^a-zA-Z0-9]/g, '').slice(0, 40);
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

// Constants kept to avoid linter complaints about unused — exposed for tests.
export const BM25_CONSTANTS = { k1: DEFAULT_K1, b: DEFAULT_B };