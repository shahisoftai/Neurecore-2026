/**
 * Clients — Module (Phase 2B)
 *
 * Wires the engine-side adapters that bridge external domain services
 * (Projects, Onboarding) into the information engine. Today only the
 * ProjectsAdapter ships; the onboarding flow is wired via the dedicated
 * ProjectTypeAllocatorService in `project-types/allocators/` which is
 * a single-responsibility helper, not a polymorphic adapter.
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
