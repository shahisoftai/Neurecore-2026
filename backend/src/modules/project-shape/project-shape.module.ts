/**
 * ProjectShapeModule — DI wiring for AI-driven project shape synthesis.
 *
 * Not @Global. Consumers (CreateProjectTool → ProjectsService) import it
 * explicitly to avoid the same init-order issues we hit with
 * ProjectAutomationModule.
 *
 * Phase 0 G4: imports KnowledgeModule so the optional RAGPipeline is
 * available for industry-aware few-shot retrieval. RAG is degraded
 * gracefully when not wired (test environments, etc).
 */

import { Module } from '@nestjs/common';
import { ProjectShapeSynthesisService } from './project-shape-synthesis.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';

@Module({
  imports: [AIGatewayModule, KnowledgeModule],
  providers: [ProjectShapeSynthesisService],
  exports: [ProjectShapeSynthesisService],
})
export class ProjectShapeModule {}
