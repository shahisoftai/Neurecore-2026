/**
 * Knowledge module — domain interfaces.
 *
 * Phase 6, Task 6.1 (per EAOS-implementation-roadmap.md §10 +
 * EAOS-implementation-plan.md §7.1, §9.7 + EAOS-api-contract.md §8.17).
 *
 * SOLID — Interface Segregation: four focused interfaces instead of one
 * fat service. Consumers depend only on what they need:
 *
 *   IChunkingService       — text → chunks (SRP)
 *   IEmbeddingsService     — text → vector
 *   IVectorStore           — vector upsert / search / delete
 *   IRAGPipeline           — full pipeline (compose the three above + LLM)
 *
 * Each interface is injected via NestJS DI token (`@Inject(TOKEN)`) so
 * implementations can be swapped (pgvector ↔ in-memory; OpenAI ↔ MiniMax)
 * without touching the consumers.
 */

export interface KnowledgeChunk {
  /** Stable id within an entry — used for citations. */
  readonly chunkIndex: number;
  /** The chunk text. */
  readonly text: string;
  /** Approximate token count (chars / 4). */
  readonly tokenEstimate: number;
}

export interface IChunkingService {
  /** Split `text` into chunks respecting natural boundaries. */
  split(text: string, options?: ChunkingOptions): KnowledgeChunk[];
}

export interface ChunkingOptions {
  /** Max characters per chunk. Default 1200. */
  maxChunkChars?: number;
  /** Overlap characters between consecutive chunks. Default 200. */
  overlapChars?: number;
}

export interface IEmbeddingsService {
  /** Generate an embedding vector for a single piece of text. */
  embedQuery(text: string): Promise<number[] | null>;
  /** Generate embeddings for an array of texts. */
  embedDocuments(texts: string[]): Promise<(number[] | null)[]>;
  /** The dimensionality of generated vectors. */
  readonly dimensions: number;
}

export interface VectorSearchHit {
  readonly id: string;
  readonly score: number; // cosine similarity ∈ [-1, 1]
}

export interface IVectorStore {
  /** Upsert a vector against `id` (entry id). */
  upsert(id: string, vector: number[]): Promise<void>;
  /** Cosine-similarity top-K search across all vectors. */
  search(queryVector: number[], topK: number): Promise<VectorSearchHit[]>;
  /** Remove a vector by id. */
  delete(id: string): Promise<void>;
  /** Bulk delete (for re-index / migration). */
  deleteMany(ids: string[]): Promise<void>;
}

export interface RAGContextChunk {
  readonly entryId: string;
  readonly title: string;
  readonly type: string;
  readonly text: string;
  readonly score: number; // blended hybrid score ∈ [0, 1]
  readonly chunkIndex: number;
}

export interface RAGAnswer {
  readonly answer: string;
  readonly citations: RAGCitation[];
  readonly model: string;
  readonly tokensUsed: { input: number; output: number; total: number };
  readonly confidence: number;
}

export interface RAGCitation {
  readonly knowledgeEntryId: string;
  readonly label: string;
  readonly span: string; // e.g. "Chunk 2 / 4"
  readonly confidence: number; // blended hybrid score
  readonly chunkIndex: number;
}

export interface IRAGPipeline {
  /**
   * Run the full RAG pipeline for `question`.
   * Returns the LLM-generated answer + citations ready for the UI chip.
   */
  ask(
    tenantId: string,
    question: string,
    options?: RAGPipelineOptions,
  ): Promise<RAGAnswer>;

  /** Stream variant — yields content deltas + a final citations payload. */
  stream(
    tenantId: string,
    question: string,
    options?: RAGPipelineOptions,
  ): AsyncIterable<RAGStreamEvent>;
}

export type RAGStreamEvent =
  | { type: 'start'; citations: RAGCitation[] }
  | { type: 'delta'; text: string }
  | { type: 'done'; citations: RAGCitation[]; tokensUsed: { input: number; output: number; total: number } }
  | { type: 'error'; message: string };

export interface RAGPipelineOptions {
  /** Limit retrieval to specific entry types (POLICY, SOP, …). */
  types?: string[];
  /** Filter to entries tagged with at least one of these. */
  tags?: string[];
  /** Restrict to a single department. */
  departmentId?: string;
  /** Number of chunks to retrieve. Default 10. */
  topK?: number;
  /** Max context tokens to assemble. Default 4000. */
  maxContextTokens?: number;
  /** α weight for vector similarity (β = 1 - α for BM25). Default 0.7. */
  vectorWeight?: number;
}

// ─── DI tokens ────────────────────────────────────────────────────────────

export const CHUNKING_SERVICE = Symbol('CHUNKING_SERVICE');
export const EMBEDDINGS_SERVICE = Symbol('EMBEDDINGS_SERVICE');
export const VECTOR_STORE = Symbol('VECTOR_STORE');
export const RAG_PIPELINE = Symbol('RAG_PIPELINE');