/**
 * QuestionPack — Prisma Repository (Phase 2B)
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import type {
  IQuestionPackRepository,
  QuestionPack,
  CreateQuestionPackInput,
  UpdateQuestionPackInput,
  ListQuestionPacksOptions,
} from '../interfaces/question-pack.interface';

@Injectable()
export class PrismaQuestionPackRepository implements IQuestionPackRepository {
  private readonly logger = new Logger(PrismaQuestionPackRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateQuestionPackInput): Promise<QuestionPack> {
    const created = await this.prisma.questionPack.create({
      data: {
        key: input.key,
        name: input.name,
        description: input.description ?? null,
        isSystem: input.isSystem ?? false,
        questions: input.questions as unknown as Prisma.InputJsonValue,
      },
    });
    return mapToPack(created);
  }

  async findById(id: string): Promise<QuestionPack | null> {
    const found = await this.prisma.questionPack.findUnique({ where: { id } });
    return found ? mapToPack(found) : null;
  }

  async findByKey(key: string): Promise<QuestionPack | null> {
    const found = await this.prisma.questionPack.findUnique({ where: { key } });
    return found ? mapToPack(found) : null;
  }

  async findAll(
    opts: ListQuestionPacksOptions,
  ): Promise<{ data: QuestionPack[]; total: number }> {
    const where: Record<string, unknown> = {};
    if (opts.search) {
      where.name = { contains: opts.search, mode: 'insensitive' };
    }
    if (opts.isSystem !== undefined) {
      where.isSystem = opts.isSystem;
    }
    const page = opts.page ?? 1;
    const limit = opts.limit ?? 20;

    const [items, total] = await Promise.all([
      this.prisma.questionPack.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.questionPack.count({ where }),
    ]);
    return { data: items.map(mapToPack), total };
  }

  async update(
    id: string,
    input: UpdateQuestionPackInput,
  ): Promise<QuestionPack> {
    const data: Record<string, unknown> = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) data.description = input.description;
    if (input.questions !== undefined) {
      data.questions = input.questions as unknown as Prisma.InputJsonValue;
    }
    const updated = await this.prisma.questionPack.update({
      where: { id },
      data,
    });
    this.logger.log(`Updated question pack ${id}`);
    return mapToPack(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.questionPack.delete({ where: { id } });
    this.logger.log(`Deleted question pack ${id}`);
  }
}

function mapToPack(raw: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: number;
  isSystem: boolean;
  questions: unknown;
  createdAt: Date;
  updatedAt: Date;
}): QuestionPack {
  return {
    id: raw.id,
    key: raw.key,
    name: raw.name,
    description: raw.description,
    version: raw.version,
    isSystem: raw.isSystem,
    questions: Array.isArray(raw.questions)
      ? (raw.questions as QuestionPack['questions'])
      : [],
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
}
