/**
 * Requirements — Module (Phase 2B)
 */

import { Module } from '@nestjs/common';
import { RequirementsService } from './requirements.service';
import { AdaptiveQuestioningService } from './adaptive-questioning.service';

@Module({
  providers: [RequirementsService, AdaptiveQuestioningService],
  exports: [RequirementsService, AdaptiveQuestioningService],
})
export class RequirementsModule {}
