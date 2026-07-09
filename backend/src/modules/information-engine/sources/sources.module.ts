/**
 * Sources — Module (Phase 2B)
 */

import { Module } from '@nestjs/common';
import { SourceService } from './source.service';
import { SourceController } from './source.controller';
import { SOURCE_REPOSITORY } from './interfaces/source.interface';
import { PrismaSourceRepository } from './repositories/prisma-source.repository';

@Module({
  controllers: [SourceController],
  providers: [
    SourceService,
    {
      provide: SOURCE_REPOSITORY,
      useClass: PrismaSourceRepository,
    },
  ],
  exports: [SourceService],
})
export class SourcesModule {}
