/**
 * Responses — Module (Phase 2B)
 */

import { Module } from '@nestjs/common';
import { ResponseService } from './response.service';
import { ResponseController } from './response.controller';
import { RESPONSE_REPOSITORY } from './interfaces/response.interface';
import { PrismaResponseRepository } from './repositories/prisma-response.repository';
import { SourcesModule } from '../sources/sources.module';

@Module({
  imports: [SourcesModule],
  controllers: [ResponseController],
  providers: [
    ResponseService,
    {
      provide: RESPONSE_REPOSITORY,
      useClass: PrismaResponseRepository,
    },
  ],
  exports: [ResponseService],
})
export class ResponsesModule {}
