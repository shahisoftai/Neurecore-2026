/**
 * Information Engine — Root Module (Phase 2F)
 *
 * Aggregates every sub-module from §3.1 of project-creation-imp-plan.md.
 * Re-exports the public services that consumers depend on.
 */

import { Module } from '@nestjs/common';
import { QuestionPacksModule } from './packs/question-packs.module';
import { ProjectTypePacksModule } from './project-type-packs/project-type-packs.module';
import { SourcesModule } from './sources/sources.module';
import { ResponsesModule } from './responses/responses.module';
import { CompletenessModule } from './completeness/completeness.module';
import { RequirementsModule } from './requirements/requirements.module';
import { InterviewModule } from './interview/interview.module';
import { ExtractionModule } from './extraction/extraction.module';
import { EngineReadModule } from './engine-read.module';
import { ContinuousDiscoveryModule } from './cron/continuous-discovery.module';
import { ClientsModule } from './clients/clients.module';

@Module({
  imports: [
    QuestionPacksModule,
    ProjectTypePacksModule,
    SourcesModule,
    ResponsesModule,
    CompletenessModule,
    RequirementsModule,
    InterviewModule,
    ExtractionModule,
    EngineReadModule,
    ContinuousDiscoveryModule,
    ClientsModule,
  ],
  exports: [
    QuestionPacksModule,
    ProjectTypePacksModule,
    SourcesModule,
    ResponsesModule,
    CompletenessModule,
    RequirementsModule,
    InterviewModule,
    ExtractionModule,
    EngineReadModule,
    ContinuousDiscoveryModule,
    ClientsModule,
  ],
})
export class InformationEngineModule {}
