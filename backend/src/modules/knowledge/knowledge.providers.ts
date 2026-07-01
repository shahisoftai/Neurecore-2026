/**
 * knowledge.providers.ts — DI bindings for the knowledge module.
 *
 * Phase 6, Task 6.1.
 *
 * Each interface token (CHUNKING_SERVICE / EMBEDDINGS_SERVICE / VECTOR_STORE)
 * is bound to a concrete provider class so consumers can inject via
 * `@Inject(TOKEN)`. The bindings use `useClass` so NestJS still handles
 * lifecycle (singleton scope by default).
 */

import { Provider } from '@nestjs/common';
import { ChunkingService } from './services/chunking.service';
import { EmbeddingsService } from './services/embeddings.service';
import { PgVectorStore } from './services/vector-store.service';
import { HybridSearchService } from './services/hybrid-search.service';
import { RAGPipeline } from './services/rag-pipeline.service';
import {
  CHUNKING_SERVICE,
  EMBEDDINGS_SERVICE,
  RAG_PIPELINE,
  VECTOR_STORE,
} from './interfaces/knowledge.interface';

export const knowledgeProviders: Provider[] = [
  // Concrete classes (also available via their own DI tokens)
  ChunkingService,
  EmbeddingsService,
  HybridSearchService,
  RAGPipeline,
  PgVectorStore,

  // Interface → concrete class bindings
  { provide: CHUNKING_SERVICE, useExisting: ChunkingService },
  { provide: EMBEDDINGS_SERVICE, useExisting: EmbeddingsService },
  { provide: VECTOR_STORE, useExisting: PgVectorStore },
  { provide: RAG_PIPELINE, useExisting: RAGPipeline },
];