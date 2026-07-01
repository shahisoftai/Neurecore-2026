/**
 * EmbeddingsService — text → vector via OpenAI text-embedding-3-small.
 *
 * Phase 6, Task 6.1 (per EAOS-implementation-plan.md §9.7).
 *
 * Default model: `text-embedding-3-small` (1536 dims, $0.02 / 1M tokens).
 * Override via `EMBEDDING_MODEL` env (and `EMBEDDING_DIM` to match the
 * `vector(N)` column in the migration). For tenants without an
 * `OPENAI_API_KEY`, returns `null` and the system falls back to
 * BM25-only keyword search (see VectorStoreService search fallback).
 *
 * SOLID — SRP: owns ONLY embedding generation. DIP: implements
 * `IEmbeddingsService` so consumers (RAGPipeline) can swap providers.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IEmbeddingsService } from '../interfaces/knowledge.interface';

@Injectable()
export class EmbeddingsService implements IEmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name);
  private readonly cache = new Map<string, number[]>();
  private readonly cacheLimit = 1_000;

  readonly dimensions: number;

  constructor(private readonly config: ConfigService) {
    this.dimensions = Number(this.config.get('EMBEDDING_DIM') ?? 1536);
  }

  async embedQuery(text: string): Promise<number[] | null> {
    if (!text.trim()) return null;
    return this.embed([text]).then((v) => v[0] ?? null);
  }

  async embedDocuments(texts: string[]): Promise<(number[] | null)[]> {
    if (!texts.length) return [];
    return this.embed(texts);
  }

  private async embed(texts: string[]): Promise<(number[] | null)[]> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn(
        'OPENAI_API_KEY not set — embeddings disabled (BM25-only fallback).',
      );
      return texts.map(() => null);
    }

    const model =
      this.config.get<string>('EMBEDDING_MODEL') ?? 'text-embedding-3-small';

    // Cache hit short-circuit
    const results: (number[] | null)[] = new Array(texts.length);
    const toFetch: { idx: number; text: string }[] = [];
    for (let i = 0; i < texts.length; i++) {
      const cached = this.cache.get(texts[i]);
      if (cached) {
        results[i] = cached;
      } else {
        toFetch.push({ idx: i, text: texts[i] });
      }
    }
    if (toFetch.length === 0) return results;

    try {
      const { default: OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey });
      // OpenAI supports batch input (≤ 2048 inputs per call)
      const resp = await client.embeddings.create({
        model,
        input: toFetch.map((t) => t.text),
      });
      for (let i = 0; i < toFetch.length; i++) {
        const vec = resp.data[i]?.embedding ?? null;
        results[toFetch[i].idx] = vec;
        if (vec) this.putCache(toFetch[i].text, vec);
      }
      return results;
    } catch (err) {
      this.logger.error(
        `Embedding generation failed: ${(err as Error).message}`,
      );
      return toFetch.reduce<(number[] | null)[]>((acc, _, i) => {
        acc[toFetch[i].idx] = null;
        return acc;
      }, results);
    }
  }

  private putCache(text: string, vec: number[]) {
    if (this.cache.size >= this.cacheLimit) {
      // simple FIFO eviction — first key
      const first = this.cache.keys().next().value;
      if (first !== undefined) this.cache.delete(first);
    }
    this.cache.set(text, vec);
  }
}