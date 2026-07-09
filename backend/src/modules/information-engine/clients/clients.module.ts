/**
 * Clients — Module (Phase 2E)
 *
 * Wires the ProjectsAdapter that bridges ProjectsService → EIE.
 * OnboardingAdapter ships in sub-phase 2G.
 */

import { Module, forwardRef } from '@nestjs/common';
import { ProjectsAdapter } from './projects.adapter';
import { RequirementsModule } from '../requirements/requirements.module';
import { ResponsesModule } from '../responses/responses.module';
import { CompletenessModule } from '../completeness/completeness.module';
import { ProjectTypePacksModule } from '../project-type-packs/project-type-packs.module';
import { ProjectTypesModule } from '../../project-types/project-types.module';
import { ProjectsModule } from '../../projects/projects.module';
import { InterviewModule } from '../interview/interview.module';
import { ExtractionModule } from '../extraction/extraction.module';

@Module({
  imports: [
    RequirementsModule,
    ResponsesModule,
    CompletenessModule,
    ProjectTypePacksModule,
    forwardRef(() => ProjectTypesModule),
    forwardRef(() => ProjectsModule),
    InterviewModule,
    ExtractionModule,
  ],
  providers: [ProjectsAdapter],
  exports: [ProjectsAdapter],
})
export class ClientsModule {}
