/**
 * Costs Module
 *
 * Cost tracking and budget management for Paperclip integration
 * Following SOLID principles with proper dependency injection
 */

import { Module } from '@nestjs/common';
import { CostsController } from './costs.controller';
import { CostsService } from './services/costs.service';
import { LangSmithCostProvider } from './providers/langsmith-cost-provider';
import { PrismaCostRecordRepository } from './repositories/prisma-cost.repository';
import {
  PrismaBudgetPolicyRepository,
  PrismaBudgetIncidentRepository,
} from './repositories/prisma-budget.repository';
import { AgentsModule } from '../agents/agents.module';

@Module({
  imports: [AgentsModule],
  controllers: [CostsController],
  providers: [
    // Main service
    CostsService,

    // Cost provider (uses existing LangSmith/LLMFactory)
    LangSmithCostProvider,

    // Repositories
    PrismaCostRecordRepository,
    PrismaBudgetPolicyRepository,
    PrismaBudgetIncidentRepository,
  ],
  exports: [CostsService],
})
export class CostsModule {}
