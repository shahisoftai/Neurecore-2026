/**
 * ProjectShapeModule — DI wiring for AI-driven project shape synthesis.
 *
 * Not @Global. Consumers (CreateProjectTool → ProjectsService) import it
 * explicitly to avoid the same init-order issues we hit with
 * ProjectAutomationModule.
 */

import { Module } from '@nestjs/common';
import { ProjectShapeSynthesisService } from './project-shape-synthesis.service';
import { AIGatewayModule } from '../ai-gateway/ai-gateway.module';

@Module({
  imports: [AIGatewayModule],
  providers: [ProjectShapeSynthesisService],
  exports: [ProjectShapeSynthesisService],
})
export class ProjectShapeModule {}
