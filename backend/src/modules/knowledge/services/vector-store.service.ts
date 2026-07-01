/**
 * VectorStoreService — pgvector operations on KnowledgeEntry.contentVector.
 *
 * Phase 6, Task 6.1 (per EAOS-implementation-plan.md §9.7).
 *
 * Uses raw SQL via PrismaService for pgvector support (Prisma has no native
 * pgvector type). The `contentVector` column is `Unsupported("vector(1536)")`
 * — Prisma can't read/write it, so we manage it via $queryRaw / $executeRaw.
 *
 * Search uses cosine distance (`<=>`) and the HNSW index created in the
 * 20260628_eaos_4_knowledge_hub migration. Returns score = 1 - distance so
 * higher = better (semantic similarity ∈ [0, 1]).
 *
 * SOLID — SRP: owns ONLY vector CRUD + search. DIP: implements
 * `IVectorStore` so the RAGPipeline can swap to an in-memory fallback
 * (e.g. for tests or tenants without pgvector enabled).
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IVectorStore,
  VectorSearchHit,
} from '../interfaces/knowledge.interface';

const VECTOR_LITERAL = (v: number[]) => `[${v.join(',')}]`;

@Injectable()
export class PgVectorStore implements IVectorStore {
  private readonly logger = new Logger(PgVectorStore.name);

  constructor(private readonly prisma: PrismaService) {}

  async upsert(id: string, vector: number[]): Promise<void> {
    if (!vector?.length) {
      this.logger.warn(`upsert(${id}) skipped — empty vector`);
      return;
    }
    await this.prisma.$executeRawUnsafe(
      `UPDATE "knowledge_entries"
         SET "contentVector" = $1::vector
       WHERE "id" = $2`,
      VECTOR_LITERAL(vector),
      id,
    );
  }

  async search(queryVector: number[], topK: number): Promise<VectorSearchHit[]> {
    if (!queryVector?.length) return [];

    // Cosine distance in pgvector is `<=>`; similarity = 1 - distance.
    const rows = await this.prisma.$queryRawUnsafe<
      { id: string; score: number }[]
    >(
      `SELECT "id",
              1 - ("contentVector" <=> $1::vector) AS score
         FROM "knowledge_entries"
        WHERE "contentVector" IS NOT NULL
          AND "status" = 'published'
        ORDER BY "contentVector" <=> $1::vector
        LIMIT $2`,
      VECTOR_LITERAL(queryVector),
      Math.max(1, Math.min(200, topK)),
    );

    return rows.map((r) => ({
      id: r.id,
      score: Number(r.score),
    }));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.$executeRawUnsafe(
      `UPDATE "knowledge_entries"
         SET "contentVector" = NULL
       WHERE "id" = $1`,
      id,
    );
  }

  async deleteMany(ids: string[]): Promise<void> {
    if (!ids.length) return;
    await this.prisma.$executeRawUnsafe(
      `UPDATE "knowledge_entries"
         SET "contentVector" = NULL
       WHERE "id" = ANY($1::text[])`,
      ids,
    );
  }
}