/**
 * Extraction — Module (Phase 2E)
 *
 * Wires DocumentExtractionService + ExtractionController. Replaces the
 * 2B placeholder.
 */

import { Module, forwardRef } from '@nestjs/common';
import { DocumentExtractionService } from './document-extraction.service';
import { ExtractionController } from './extraction.controller';
import { ResponsesModule } from '../responses/responses.module';
import { CompletenessModule } from '../completeness/completeness.module';
import { ProjectTypePacksModule } from '../project-type-packs/project-type-packs.module';
import { RequirementsModule } from '../requirements/requirements.module';
import { ProjectTypesModule } from '../../project-types/project-types.module';

@Module({
  imports: [
    ResponsesModule,
    CompletenessModule,
    ProjectTypePacksModule,
    RequirementsModule,
    forwardRef(() => ProjectTypesModule),
  ],
  controllers: [ExtractionController],
  providers: [DocumentExtractionService],
  exports: [DocumentExtractionService],
})
export class ExtractionModule {}
