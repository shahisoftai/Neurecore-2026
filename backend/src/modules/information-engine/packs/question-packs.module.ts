/**
 * QuestionPacks — Module (Phase 2B)
 */

import { Module } from '@nestjs/common';
import { QuestionPackService } from './question-packs.service';
import { QuestionPackController } from './question-packs.controller';
import { QUESTION_PACK_REPOSITORY } from './interfaces/question-pack.interface';
import { PrismaQuestionPackRepository } from './repositories/prisma-question-pack.repository';

@Module({
  controllers: [QuestionPackController],
  providers: [
    QuestionPackService,
    {
      provide: QUESTION_PACK_REPOSITORY,
      useClass: PrismaQuestionPackRepository,
    },
  ],
  exports: [QuestionPackService],
})
export class QuestionPacksModule {}
