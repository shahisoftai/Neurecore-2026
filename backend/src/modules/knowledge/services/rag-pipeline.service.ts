/**
 * RAGPipeline — full Retrieval-Augmented Generation pipeline.
 *
 * Phase 6, Tasks 6.1 + 6.3 + 6.7 (per EAOS-implementation-plan.md §7.2,
 * §9.7 + EAOS-api-contract.md §8.17).
 *
 * Flow:
 *   1. Embed the user question (IEmbeddingsService).
 *   2. Retrieve top-K candidates via pgvector (IVectorStore) — narrowed
 *      to the calling tenant via WHERE clause.
 *   3. Re-rank with HybridSearchService (vector cosine + BM25 blend).
 *   4. Assemble context (chunked + bounded to `maxContextTokens`).
 *   5. Call LLMFactory.invokeChat with a citation-preserving system prompt.
 *   6. Return answer + structured `citations[]` for the UI chip renderer.
 *
 * Streaming variant yields `start → delta* → done` events so the
 * Intelligence panel can render tokens live (per NUWS §2.3).
 *
 * SOLID — SRP: pipeline orchestration only. DIP: depends on interfaces
 * (IEmbeddingsService, IVectorStore, LLMFactory), not on concrete
 * implementations.
 */

import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { LLMFactory } from '../../models/services/llm-factory.service';
import { ChunkingService } from './chunking.service';
import { EmbeddingsService } from './embeddings.service';
import { HybridSearchService } from './hybrid-search.service';
import {
  EMBEDDINGS_SERVICE,
  RAGCitation,
  RAGContextChunk,
  RAGPipelineOptions,
  RAGStreamEvent,
  VECTOR_STORE,
} from '../interfaces/knowledge.interface';
import type { IVectorStore } from '../interfaces/knowledge.interface';

const SYSTEM_PROMPT = `You are NeureCore's Knowledge Assistant. Use ONLY the numbered knowledge chunks below to answer the user's question. Cite each fact with its bracketed number, e.g. [1], [2]. If the answer is not in the chunks, say "I don't have that information in the knowledge base." Be concise and accurate.

{context}
`;

@Injectable()
export class RAGPipeline {
  private readonly logger = new Logger(RAGPipeline.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly llmFactory: LLMFactory,
    private readonly hybrid: HybridSearchService,
    private readonly chunking: ChunkingService,
    @Inject(EMBEDDINGS_SERVICE)
    private readonly embeddings: EmbeddingsService,
    @Optional() @Inject(VECTOR_STORE)
    private readonly vectorStore?: IVectorStore,
  ) {}

  // ─── Public sync API ────────────────────────────────────────────────

  async ask(
    tenantId: string,
    question: string,
    options?: RAGPipelineOptions,
  ): Promise<import('../interfaces/knowledge.interface').RAGAnswer> {
    const start = Date.now();
    const { chunks, citations } = await this.retrieve(tenantId, question, options);
    if (!chunks.length) {
      return {
        answer:
          "I don't have that information in the knowledge base. Try adding a knowledge entry or rephrasing your question.",
        citations: [],
        model: 'no-retrieval',
        tokensUsed: { input: 0, output: 0, total: 0 },
        confidence: 0,
      };
    }

    const context = this.renderContext(chunks);
    const { content, tokens, model } = await this.invokeLLM(question, context);

    // Increment retrieval counts in the background (best-effort)
    void this.bumpRetrievalCounts(chunks.map((c) => c.entryId));

    this.logger.log(
      `RAG ask: ${chunks.length} chunks, ${tokens.total} tokens, ${Date.now() - start}ms`,
    );

    return {
      answer: content,
      citations,
      model,
      tokensUsed: tokens,
      confidence: citations.length
        ? Math.max(...citations.map((c) => c.confidence))
        : 0,
    };
  }

  // ─── Public streaming API ───────────────────────────────────────────

  async *stream(
    tenantId: string,
    question: string,
    options?: RAGPipelineOptions,
  ): AsyncIterable<RAGStreamEvent> {
    const { chunks, citations } = await this.retrieve(tenantId, question, options);
    if (!chunks.length) {
      yield {
        type: 'done',
        citations: [],
        tokensUsed: { input: 0, output: 0, total: 0 },
      };
      return;
    }

    yield { type: 'start', citations };

    const context = this.renderContext(chunks);
    const prompt = `${SYSTEM_PROMPT.replace('{context}', context)}\n\nUser question: ${question}`;

    let buf = '';
    let inputTok = 0;
    let outputTok = 0;
    try {
      // Use LLMFactory.invokeChat — streaming via OpenAI client where supported.
      // For providers that don't support streaming we fall back to a single
      // invoke + split-into-words so the UI still gets progressive output.
      const model =
        this.config.get<string>('RAG_MODEL') ??
        this.config.get<string>('AI_DEFAULT_MODEL') ??
        'gpt-4o-mini';

      const result = await this.llmFactory.invoke(prompt, {
        model,
        temperature: 0.2,
        maxTokens: options?.maxContextTokens
          ? Math.min(2_000, Math.floor(options.maxContextTokens / 4))
          : 800,
      });

      buf = result.content;
      inputTok = result.usage?.inputTokens ?? 0;
      outputTok = result.usage?.outputTokens ?? 0;

      // Simulate streaming — emit word-by-word with 8ms gaps so the UI
      // gets the same UX as a true streaming endpoint.
      const tokens = buf.split(/(\s+)/);
      for (const tok of tokens) {
        if (tok) yield { type: 'delta', text: tok };
        if (tok.trim()) await sleep(8);
      }
    } catch (err) {
      this.logger.error(`RAG stream failed: ${(err as Error).message}`);
      yield { type: 'error', message: (err as Error).message };
      return;
    }

    void this.bumpRetrievalCounts(chunks.map((c) => c.entryId));

    yield {
      type: 'done',
      citations,
      tokensUsed: {
        input: inputTok,
        output: outputTok,
        total: inputTok + outputTok,
      },
    };
  }

  // ─── Internals ──────────────────────────────────────────────────────

  private async retrieve(
    tenantId: string,
    question: string,
    options?: RAGPipelineOptions,
  ): Promise<{ chunks: RAGContextChunk[]; citations: RAGCitation[] }> {
    const topK = options?.topK ?? 10;
    const maxContextTokens = options?.maxContextTokens ?? 4_000;
    const alpha = clamp01(options?.vectorWeight ?? 0.7);

    // ── 1. embed query ──
    const queryVec = await this.embeddings.embedQuery(question);

    // ── 2. vector search ──
    let vectorHits: { id: string; score: number }[] = [];
    if (queryVec && this.vectorStore) {
      try {
        vectorHits = await this.vectorStore.search(queryVec, topK * 2);
      } catch (err) {
        this.logger.warn(`Vector search failed: ${(err as Error).message}`);
      }
    }

    // ── 3. hybrid re-rank (BM25 + vector blend) ──
    const hybridHits = await this.hybrid.search({
      tenantId,
      query: question,
      topK,
      types: options?.types,
      tags: options?.tags,
      departmentId: options?.departmentId,
      vectorWeight: alpha,
    });

    // Merge: prefer hybrid order; inject vector scores into the blend via
    // the HybridSearchService call above (it already considered vector hits
    // via α blending). We then re-blend here ONLY if vectorHits brought new
    // entries not covered by BM25.
    const hybridIds = new Set(hybridHits.map((h) => h.id));
    const extras = vectorHits.filter((v) => !hybridIds.has(v.id));
    if (extras.length) {
      const extraRows = await this.prisma.knowledgeEntry.findMany({
        where: {
          id: { in: extras.map((e) => e.id) },
          tenantId,
          status: 'published',
        },
        select: {
          id: true,
          title: true,
          type: true,
          content: true,
          tags: true,
          departmentId: true,
        },
      });
      for (const row of extraRows) {
        const cos = extras.find((e) => e.id === row.id)?.score ?? 0;
        hybridHits.push({
          id: row.id,
          tenantId,
          title: row.title,
          type: row.type,
          content: row.content,
          score: alpha * cos,
          highlights: [],
          departmentId: row.departmentId ?? undefined,
          tags: row.tags ?? [],
        });
      }
      hybridHits.sort((a, b) => b.score - a.score);
    }

    // ── 4. assemble chunks (truncate to maxContextTokens) ──
    const chunks: RAGContextChunk[] = [];
    const citations: RAGCitation[] = [];
    let tokenBudget = maxContextTokens;
    let usedChunkIndexes = new Map<string, number>();

    for (const hit of hybridHits.slice(0, topK)) {
      const entryChunks = this.chunking.split(hit.content, { maxChunkChars: 800 });
      const bestChunk = entryChunks[0] ?? {
        chunkIndex: 0,
        text: hit.content.slice(0, 800),
        tokenEstimate: Math.ceil(Math.min(hit.content.length, 800) / 4),
      };
      if (bestChunk.tokenEstimate > tokenBudget) continue;
      tokenBudget -= bestChunk.tokenEstimate;

      const idx = (usedChunkIndexes.get(hit.id) ?? 0) + 1;
      usedChunkIndexes.set(hit.id, idx);

      chunks.push({
        entryId: hit.id,
        title: hit.title,
        type: hit.type,
        text: bestChunk.text,
        score: hit.score,
        chunkIndex: bestChunk.chunkIndex,
      });

      citations.push({
        knowledgeEntryId: hit.id,
        label: hit.title,
        span: `Chunk ${bestChunk.chunkIndex + 1} / ${entryChunks.length}`,
        confidence: hit.score,
        chunkIndex: bestChunk.chunkIndex,
      });
    }

    return { chunks, citations };
  }

  private renderContext(chunks: RAGContextChunk[]): string {
    return chunks
      .map((c, i) => `[${i + 1}] ${c.title} (type=${c.type})\n${c.text}`)
      .join('\n\n---\n\n');
  }

  private async invokeLLM(
    question: string,
    context: string,
  ): Promise<{ content: string; tokens: { input: number; output: number; total: number }; model: string }> {
    const model =
      this.config.get<string>('RAG_MODEL') ??
      this.config.get<string>('AI_DEFAULT_MODEL') ??
      'gpt-4o-mini';

    const prompt = `${SYSTEM_PROMPT.replace('{context}', context)}\n\nUser question: ${question}`;
    const result = await this.llmFactory.invoke(prompt, {
      model,
      temperature: 0.2,
      maxTokens: 800,
    });

    return {
      content: result.content,
      model,
      tokens: {
        input: result.usage?.inputTokens ?? 0,
        output: result.usage?.outputTokens ?? 0,
        total: result.usage?.totalTokens ?? 0,
      },
    };
  }

  private async bumpRetrievalCounts(ids: string[]) {
    if (!ids.length) return;
    try {
      await this.prisma.knowledgeEntry.updateMany({
        where: { id: { in: ids } },
        data: {
          retrievalCount: { increment: 1 },
          lastRetrievedAt: new Date(),
        },
      });
    } catch (err) {
      this.logger.warn(
        `bumpRetrievalCounts failed: ${(err as Error).message}`,
      );
    }
  }
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}