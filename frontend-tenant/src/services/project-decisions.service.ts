/**
 * project-decisions.service.ts — Phase 5 Decision Registry service
 *
 * Wraps the backend project-decisions API for the tenant UI.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export type DecisionStatus = 'PROPOSED' | 'APPROVED' | 'REJECTED' | 'SUPERSEDED';
export type VoteOption = 'FOR' | 'AGAINST' | 'ABSTAIN';

export interface ProjectDecision {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: DecisionStatus;
  decidedAt: string | null;
  approvedById: string | null;
  approvedByType: string | null;
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  meetingNotes: string | null;
  rationale: string | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  supersededBy: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export const projectDecisionsService = {
  async list(opts?: {
    projectId?: string;
    status?: DecisionStatus;
    linkedEntityId?: string;
    page?: number;
    limit?: number;
  }): Promise<{ items: ProjectDecision[]; total: number }> {
    const res = await api.get('/project-decisions', { params: opts });
    const { items, total } = unwrapList(res);
    return { items: items as ProjectDecision[], total: total ?? items.length };
  },

  async get(id: string): Promise<ProjectDecision> {
    const res = await api.get(`/project-decisions/${id}`);
    return unwrapItem(res) as ProjectDecision;
  },

  async create(payload: {
    projectId: string;
    title: string;
    description?: string;
    rationale?: string;
    meetingNotes?: string;
    effectiveDate?: string;
    expiryDate?: string;
    linkedEntityType?: string;
    linkedEntityId?: string;
  }): Promise<ProjectDecision> {
    const res = await api.post('/project-decisions', payload);
    return unwrapItem(res) as ProjectDecision;
  },

  async update(
    id: string,
    payload: {
      title?: string;
      description?: string;
      status?: DecisionStatus;
      rationale?: string;
      meetingNotes?: string;
      effectiveDate?: string | null;
      expiryDate?: string | null;
    },
  ): Promise<ProjectDecision> {
    const res = await api.patch(`/project-decisions/${id}`, payload);
    return unwrapItem(res) as ProjectDecision;
  },

  async castVote(id: string, vote: VoteOption): Promise<ProjectDecision> {
    const res = await api.post(`/project-decisions/${id}/vote`, { vote });
    return unwrapItem(res) as ProjectDecision;
  },

  async approve(
    id: string,
    approvedById: string,
    approvedByType = 'HUMAN',
  ): Promise<ProjectDecision> {
    const res = await api.post(`/project-decisions/${id}/approve`, {
      approvedById,
      approvedByType,
    });
    return unwrapItem(res) as ProjectDecision;
  },
};
