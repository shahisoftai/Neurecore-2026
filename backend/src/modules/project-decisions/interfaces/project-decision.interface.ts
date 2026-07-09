/**
 * project-decisions module — Interface Definitions
 *
 * Phase 5: Project Memory + Decision Registry
 * Decisions with voting and approval tracking.
 *
 * SOLID: Interface Segregation, Dependency Inversion.
 */

import type { DecisionStatus } from '@prisma/client';

export type ProjectDecision = {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: DecisionStatus;
  decidedAt: Date | null;
  approvedById: string | null;
  approvedByType: string | null;
  votesFor: number;
  votesAgainst: number;
  abstentions: number;
  meetingNotes: string | null;
  rationale: string | null;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  supersededBy: string | null;
  linkedEntityType: string | null;
  linkedEntityId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export interface CreateDecisionInput {
  projectId: string;
  title: string;
  description?: string;
  status?: DecisionStatus;
  rationale?: string;
  meetingNotes?: string;
  effectiveDate?: Date;
  expiryDate?: Date;
  linkedEntityType?: string;
  linkedEntityId?: string;
}

export interface UpdateDecisionInput {
  title?: string;
  description?: string;
  status?: DecisionStatus;
  rationale?: string;
  meetingNotes?: string;
  effectiveDate?: Date | null;
  expiryDate?: Date | null;
  supersededBy?: string | null;
}

export interface CastVoteInput {
  vote: 'FOR' | 'AGAINST' | 'ABSTAIN';
}

export interface ListDecisionsOptions {
  projectId?: string;
  status?: DecisionStatus;
  linkedEntityId?: string;
  page?: number;
  limit?: number;
}

export interface IProjectDecisionRepository {
  create(data: CreateDecisionInput): Promise<ProjectDecision>;
  findById(id: string, tenantId: string): Promise<ProjectDecision | null>;
  findAll(options: ListDecisionsOptions, tenantId: string): Promise<{ data: ProjectDecision[]; total: number }>;
  update(id: string, tenantId: string, data: UpdateDecisionInput): Promise<ProjectDecision>;
  castVote(id: string, vote: 'FOR' | 'AGAINST' | 'ABSTAIN'): Promise<ProjectDecision>;
  approve(id: string, approvedById: string, approvedByType: string): Promise<ProjectDecision>;
  supersede(id: string, supersededById: string): Promise<void>;
}

