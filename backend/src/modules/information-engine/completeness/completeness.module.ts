/**
 * Completeness — Module (Phase 2B)
 */

import { Module } from '@nestjs/common';
import { CompletenessService } from './completeness.service';
import { CompletenessController } from './completeness.controller';
import { COMPLETENESS_REPOSITORY } from './interfaces/completeness.interface';
import { PrismaCompletenessRepository } from './repositories/prisma-completeness.repository';

@Module({
  controllers: [CompletenessController],
  providers: [
    CompletenessService,
    {
      provide: COMPLETENESS_REPOSITORY,
      useClass: PrismaCompletenessRepository,
    },
  ],
  exports: [CompletenessService],
})
export class CompletenessModule {}
