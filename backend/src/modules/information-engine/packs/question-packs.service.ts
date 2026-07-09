/**
 * QuestionPack — Service (Phase 2B)
 */

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { QUESTION_PACK_REPOSITORY } from './interfaces/question-pack.interface';
import type {
  IQuestionPackService,
  IQuestionPackRepository,
  QuestionPack,
  CreateQuestionPackInput,
  UpdateQuestionPackInput,
  ListQuestionPacksOptions,
} from './interfaces/question-pack.interface';
import { EngineErrors } from '../common/apperrors';
import { validateInformationRequirements } from '../common/legacy-adapter';

@Injectable()
export class QuestionPackService implements IQuestionPackService {
  private readonly logger = new Logger(QuestionPackService.name);

  constructor(
    @Inject(QUESTION_PACK_REPOSITORY)
    private readonly repo: IQuestionPackRepository,
  ) {}

  async createPack(input: CreateQuestionPackInput): Promise<QuestionPack> {
    this.validatePackInput(input.key, input.questions);
    const existing = await this.repo.findByKey(input.key);
    if (existing) {
      throw new BadRequestException(
        `QuestionPack with key "${input.key}" already exists`,
      );
    }
    return this.repo.create(input);
  }

  async findPack(id: string): Promise<QuestionPack> {
    const found = await this.repo.findById(id);
    if (!found) throw EngineErrors.notFound('QuestionPack', id);
    return found;
  }

  async findPackByKey(key: string): Promise<QuestionPack | null> {
    return this.repo.findByKey(key);
  }

  async listPacks(
    opts: ListQuestionPacksOptions = {},
  ): Promise<{ data: QuestionPack[]; total: number }> {
    return this.repo.findAll(opts);
  }

  async updatePack(
    id: string,
    input: UpdateQuestionPackInput,
  ): Promise<QuestionPack> {
    await this.findPack(id);
    if (input.questions) {
      const errors = validateInformationRequirements(input.questions);
      if (errors.length > 0) {
        throw EngineErrors.badRequest(
          'INVALID_QUESTIONS',
          'questions payload is malformed',
          errors,
        );
      }
    }
    return this.repo.update(id, input);
  }

  async deletePack(id: string): Promise<void> {
    const pack = await this.findPack(id);
    if (pack.isSystem) {
      throw new BadRequestException(
        `System QuestionPack "${pack.key}" cannot be deleted`,
      );
    }
    await this.repo.delete(id);
  }

  private validatePackInput(key: string, questions: unknown): void {
    if (!key || key.trim().length === 0) {
      throw EngineErrors.badRequest('INVALID_KEY', 'key is required');
    }
    const errors = validateInformationRequirements(questions);
    if (errors.length > 0) {
      throw EngineErrors.badRequest(
        'INVALID_QUESTIONS',
        'questions payload is malformed',
        errors,
      );
    }
  }
}
