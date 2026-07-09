/**
 * questionPacks.service.ts — Phase 2D admin service for QuestionPack CRUD.
 *
 * Wraps /v1/question-packs (admin-only) + /v1/project-types/:id/packs (links).
 * Mirrors `projectTypes.service.ts` shape; identical client wrappers.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';
import type { InformationRequirement } from './projectTypes.service';

export type { InformationRequirement };

export type QuestionPack = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: number;
  isSystem: boolean;
  questions: InformationRequirement[];
  createdAt: string;
  updatedAt: string;
};

export type CreateQuestionPackPayload = {
  key: string;
  name: string;
  description?: string | null;
  isSystem?: boolean;
  questions: InformationRequirement[];
};

export type UpdateQuestionPackPayload = Partial<
  Pick<CreateQuestionPackPayload, 'name' | 'description' | 'questions'>
>;

export const questionPacksService = {
  async list(
    opts: { search?: string; isSystem?: boolean; page?: number; limit?: number } = {},
  ): Promise<{ items: QuestionPack[]; total: number; page: number; limit: number }> {
    const res = await api.get('/question-packs', { params: opts });
    const data = unwrapList(res);
    return {
      items: (data.items ?? []) as QuestionPack[],
      total: data.total ?? 0,
      page: opts.page ?? 1,
      limit: opts.limit ?? 20,
    };
  },

  async get(id: string): Promise<QuestionPack> {
    const res = await api.get(`/question-packs/${id}`);
    return unwrapItem(res) as QuestionPack;
  },

  async create(payload: CreateQuestionPackPayload): Promise<QuestionPack> {
    const res = await api.post('/question-packs', payload);
    return unwrapItem(res) as QuestionPack;
  },

  async update(id: string, payload: UpdateQuestionPackPayload): Promise<QuestionPack> {
    const res = await api.patch(`/question-packs/${id}`, payload);
    return unwrapItem(res) as QuestionPack;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/question-packs/${id}`);
  },
};

export type ProjectTypePackLink = {
  projectTypeId: string;
  questionPackId: string;
  sortOrder: number;
  questionPack: QuestionPack;
};

export const projectTypePacksService = {
  async list(projectTypeId: string): Promise<ProjectTypePackLink[]> {
    const res = await api.get(`/project-types/${projectTypeId}/packs`);
    const data = res?.data ?? res;
    return Array.isArray(data) ? (data as ProjectTypePackLink[]) : [];
  },

  async replace(
    projectTypeId: string,
    packIds: string[],
  ): Promise<ProjectTypePackLink[]> {
    const res = await api.put(`/project-types/${projectTypeId}/packs`, { packIds });
    const data = res?.data ?? res;
    return Array.isArray(data) ? (data as ProjectTypePackLink[]) : [];
  },
};