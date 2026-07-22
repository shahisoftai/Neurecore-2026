/**
 * KnowledgeModule — wires the Knowledge Hub.
 *
 * Phase 6, Task 6.1 (per EAOS-implementation-roadmap.md §10).
 *
 * Wires:
 *   - Controllers: KnowledgeController
 *   - Providers: ChunkingService, EmbeddingsService, PgVectorStore,
 *                HybridSearchService, RAGPipeline, RagAskSseService,
 *                KnowledgeService, KnowledgeRagAskGuard
 *   - Module dependencies: TenantContextModule (global), ModelsModule
 *     (LLMFactory). CacheModule is @Global so RedisService is available
 *     without an explicit import.
 *
 * Exports:
 *   - KnowledgeService, RAGPipeline, HybridSearchService — so other
 *     modules (capabilities/intelligence, future Solution Packs) can
 *     re-use the RAG pipeline without duplicating it.
 */

import { Module } from '@nestjs/common';
import { KnowledgeController } from './knowledge.controller';
import { knowledgeProviders } from './knowledge.providers';
import { KnowledgeService } from './services/knowledge.service';
import { RagAskSseService } from './services/rag-ask-sse.service';
import { KnowledgeRagAskGuard } from './guards/knowledge-rag-ask.guard';
import { TenantContextModule } from '../../common/context/tenant-context.module';
import { ModelsModule } from '../models/models.module';

@Module({
  imports: [TenantContextModule, ModelsModule],
  controllers: [KnowledgeController],
  providers: [
    ...knowledgeProviders,
    KnowledgeService,
    RagAskSseService,
    KnowledgeRagAskGuard,
  ],
  exports: [
    KnowledgeService,
    RagAskSseService,
    KnowledgeRagAskGuard,
    ...knowledgeProviders,
    // Phase 7 G1 — IndustryKnowledgeSeeder is exported so OnboardingModule
    // (which already imports KnowledgeModule for the RAG pipeline) can
    // consume it via the standard provider DI binding.
  ],
})
export class KnowledgeModule {}