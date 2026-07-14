import { Module } from '@nestjs/common';
import { AI_GOVERNANCE, AIGovernancePlatform } from './ai-governance.service';
import { AIGovernanceController } from './ai-governance.controller';

@Module({
  controllers: [AIGovernanceController],
  providers: [AIGovernancePlatform, { provide: AI_GOVERNANCE, useExisting: AIGovernancePlatform }],
})
export class EnterpriseAIGovernanceModule {}
