/**
 * Interview — Module (Phase 2E)
 *
 * Wires InterviewService + InterviewController. Replaces the 2B placeholder
 * (`@Module({})`) which only existed to fix the module map early.
 */

import { Module, forwardRef } from '@nestjs/common';
import { InterviewService } from './interview.service';
import { InterviewController } from './interview.controller';
import { RequirementsModule } from '../requirements/requirements.module';
import { CompletenessModule } from '../completeness/completeness.module';
import { ResponsesModule } from '../responses/responses.module';
import { ProjectTypePacksModule } from '../project-type-packs/project-type-packs.module';
import { ProjectTypesModule } from '../../project-types/project-types.module';

@Module({
  imports: [
    RequirementsModule,
    CompletenessModule,
    ResponsesModule,
    ProjectTypePacksModule,
    forwardRef(() => ProjectTypesModule),
  ],
  controllers: [InterviewController],
  providers: [InterviewService],
  exports: [InterviewService],
})
export class InterviewModule {}
