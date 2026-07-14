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
import { ProjectCompletenessService } from './project-completeness.service';
import { EieReactiveConsumer } from '../consumers/eie-reactive.consumer';
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
  providers: [
    ProjectsAdapter,
    { provide: 'PROJECTS_ADAPTER', useExisting: ProjectsAdapter },
    ProjectCompletenessService,
    {
      provide: 'PROJECT_COMPLETENESS_SERVICE',
      useExisting: ProjectCompletenessService,
    },
    // Phase 2: capability-owned consumer reacting to enterprise events via the
    // transport port (EnterpriseEventsModule is @Global).
    EieReactiveConsumer,
  ],
  exports: [
    ProjectsAdapter,
    'PROJECTS_ADAPTER',
    ProjectCompletenessService,
    'PROJECT_COMPLETENESS_SERVICE',
  ],
})
export class ClientsModule {}
