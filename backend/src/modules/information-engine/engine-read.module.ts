/**
 * Engine Read Module — Phase 2E
 *
 * Hosts the public read endpoints (information-requirements + next-question).
 * Lives alongside the engine; imported by the root InformationEngineModule.
 */

import { Module, forwardRef } from '@nestjs/common';
import { EngineReadController } from './engine.controller';
import { RequirementsModule } from './requirements/requirements.module';
import { CompletenessModule } from './completeness/completeness.module';
import { ResponsesModule } from './responses/responses.module';
import { ProjectTypePacksModule } from './project-type-packs/project-type-packs.module';
import { ProjectTypesModule } from '../project-types/project-types.module';

@Module({
  imports: [
    RequirementsModule,
    CompletenessModule,
    ResponsesModule,
    ProjectTypePacksModule,
    forwardRef(() => ProjectTypesModule),
  ],
  controllers: [EngineReadController],
})
export class EngineReadModule {}
