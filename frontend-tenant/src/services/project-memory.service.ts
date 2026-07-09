/**
 * project-memory.service.ts — Phase 5 Memory service
 *
 * Wraps the backend project-memory API for the tenant UI.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export type MemoryCategory = 'NOTE' | 'INSIGHT' | 'CONSTRAINT' | 'RISK' | 'OPPORTUNITY' | 'LESSON';
export type AuthorType = 'HUMAN' | 'AI' | 'SYSTEM';

export interface ProjectMemory {
  id: string;
  projectId: string;
  authorId: string | null;
  authorType: AuthorType;
  category: MemoryCategory;
  content: string;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  isPinned: boolean;
  isAiGenerated: boolean;
  supersededBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const projectMemoryService = {
  async list(opts?: {
    projectId?: string;
    authorId?: string;
    category?: MemoryCategory;
    sourceEntityId?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ProjectMemory[]; total: number }> {
    const res = await api.get('/project-memory', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as ProjectMemory[], total: total ?? items.length };
  },

  async get(id: string): Promise<ProjectMemory> {
    const res = await api.get(`/project-memory/${id}`);
    return unwrapItem(res) as ProjectMemory;
  },

  async search(projectId: string, query: string): Promise<ProjectMemory[]> {
    const res = await api.get('/project-memory/search', {
      params: { projectId, query },
    });
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data
        ? (data as { data: unknown }).data
        : data;
    return Array.isArray(inner) ? (inner as ProjectMemory[]) : [];
  },

  async create(payload: {
    projectId: string;
    authorId?: string;
    authorType?: AuthorType;
    category?: MemoryCategory;
    content: string;
    sourceEntityType?: string;
    sourceEntityId?: string;
    isPinned?: boolean;
    isAiGenerated?: boolean;
  }): Promise<ProjectMemory> {
    const res = await api.post('/project-memory', payload);
    return unwrapItem(res) as ProjectMemory;
  },

  async update(
    id: string,
    payload: {
      content?: string;
      category?: MemoryCategory;
      isPinned?: boolean;
      supersededBy?: string | null;
    },
  ): Promise<ProjectMemory> {
    const res = await api.patch(`/project-memory/${id}`, payload);
    return unwrapItem(res) as ProjectMemory;
  },
};
