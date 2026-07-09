/**
 * QuestionPack — Interfaces (Phase 2B)
 */

import type {
  InformationRequirement,
  InformationRequirementType,
} from '../../common/types';

export const QUESTION_PACK_REPOSITORY = 'QUESTION_PACK_REPOSITORY';

export type QuestionItem = InformationRequirement;

export type QuestionPack = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: number;
  isSystem: boolean;
  questions: QuestionItem[];
  createdAt: Date;
  updatedAt: Date;
};

export type CreateQuestionPackInput = {
  key: string;
  name: string;
  description?: string | null;
  questions: QuestionItem[];
  isSystem?: boolean;
};

export type UpdateQuestionPackInput = Partial<
  Pick<CreateQuestionPackInput, 'name' | 'description' | 'questions'>
>;

export type ListQuestionPacksOptions = {
  search?: string;
  isSystem?: boolean;
  page?: number;
  limit?: number;
};

export interface IQuestionPackRepository {
  create(input: CreateQuestionPackInput): Promise<QuestionPack>;
  findById(id: string): Promise<QuestionPack | null>;
  findByKey(key: string): Promise<QuestionPack | null>;
  findAll(
    opts: ListQuestionPacksOptions,
  ): Promise<{ data: QuestionPack[]; total: number }>;
  update(id: string, input: UpdateQuestionPackInput): Promise<QuestionPack>;
  delete(id: string): Promise<void>;
}

export interface IQuestionPackService {
  createPack(input: CreateQuestionPackInput): Promise<QuestionPack>;
  findPack(id: string): Promise<QuestionPack>;
  findPackByKey(key: string): Promise<QuestionPack | null>;
  listPacks(
    opts?: ListQuestionPacksOptions,
  ): Promise<{ data: QuestionPack[]; total: number }>;
  updatePack(id: string, input: UpdateQuestionPackInput): Promise<QuestionPack>;
  deletePack(id: string): Promise<void>;
}

export const QUESTION_REQUIREMENT_TYPES: InformationRequirementType[] = [
  'TEXT',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
  'BOOLEAN',
  'CURRENCY',
];
