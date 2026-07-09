/**
 * projectTypes.service.ts — Phase 2 ProjectType admin service
 *
 * Wraps the backend project-types API for the admin UI.
 */

import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';

export type FieldSchemaItem = {
  key: string;
  label: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT';
  required?: boolean;
  options?: string[];
};

export type StageTemplateItem = {
  name: string;
  order: number;
  defaultDurationDays?: number;
};

export type RiskTier = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type ApprovalStep = {
  stepOrder: number;
  approverRole: string;
  approvalType: 'INTERNAL' | 'CLIENT_FACING' | 'DUAL';
  riskTier?: RiskTier[];
};

export type GoalTemplate = {
  title: string;
  measurableCriteria?: string;
};

export type ProjectTypeClassification =
  | 'CLIENT_ENGAGEMENT'
  | 'INTERNAL_INITIATIVE'
  | 'OPERATIONAL_PROGRAM';

export interface ProjectType {
  id: string;
  tenantId: string | null;
  name: string;
  industry: string | null;
  isSystem: boolean;
  classification: ProjectTypeClassification | null;
  createdAt: string;
  updatedAt: string;
  _count?: { versions: number };
}

export interface InformationRequirement {
  id: string;
  label: string;
  helpText?: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'CURRENCY';
  required: boolean;
  options?: string[];
  appliesWhen?: {
    hasCustomer?: boolean;
    classification?: ProjectTypeClassification[];
    hasEntityField?: { entityType: string; field: string; equals: unknown };
  };
  mapsTo?: { field: string };
  skipIfConfidenceGte?: number;
  askVia?: ('form' | 'interview' | 'document')[];
}

export interface ProjectTypeVersion {
  id: string;
  projectTypeId: string;
  version: number;
  fieldSchema: FieldSchemaItem[];
  stageTemplate: StageTemplateItem[];
  approvalTemplate: ApprovalStep[];
  goalTemplate: GoalTemplate[] | null;
  roleTemplate: unknown[] | null;
  informationRequirements: InformationRequirement[];
  createdAt: string;
}

export interface CreateProjectTypePayload {
  name: string;
  industry?: string;
  isSystem?: boolean;
  classification?: ProjectTypeClassification;
}

export interface UpdateProjectTypePayload {
  name?: string;
  industry?: string;
  classification?: ProjectTypeClassification | null;
}

export interface CreateVersionPayload {
  fieldSchema: FieldSchemaItem[];
  stageTemplate: StageTemplateItem[];
  approvalTemplate?: ApprovalStep[];
  goalTemplate?: GoalTemplate[];
  roleTemplate?: unknown[];
}

export const projectTypesService = {
  async list(opts?: {
    search?: string;
    industry?: string;
    classification?: ProjectTypeClassification;
    page?: number;
    limit?: number;
  }): Promise<{ items: ProjectType[]; total: number; page: number; limit: number }> {
    const res = await api.get('/project-types', { params: opts });
    const list = unwrapList(res);
    return {
      items: (list.items ?? []) as ProjectType[],
      total: list.total ?? 0,
      page: opts?.page ?? 1,
      limit: opts?.limit ?? 20,
    };
  },

  async get(id: string): Promise<ProjectType> {
    const res = await api.get(`/project-types/${id}`);
    return unwrapItem(res) as ProjectType;
  },

  async create(payload: CreateProjectTypePayload): Promise<ProjectType> {
    const res = await api.post('/project-types', payload);
    return unwrapItem(res) as ProjectType;
  },

  async update(id: string, payload: UpdateProjectTypePayload): Promise<ProjectType> {
    const res = await api.patch(`/project-types/${id}`, payload);
    return unwrapItem(res) as ProjectType;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/project-types/${id}`);
  },

  // ─── Version operations ───────────────────────────────────────────────────

  async listVersions(projectTypeId: string): Promise<ProjectTypeVersion[]> {
    const res = await api.get(`/project-types/${projectTypeId}/versions`);
    const data = res?.data ?? res;
    const inner =
      data && typeof data === 'object' && 'data' in data ? (data as { data: unknown }).data : data;
    return Array.isArray(inner) ? (inner as ProjectTypeVersion[]) : [];
  },

  async getCurrentVersion(projectTypeId: string): Promise<ProjectTypeVersion | null> {
    const res = await api.get(`/project-types/${projectTypeId}/versions/current`);
    return unwrapItem(res) as ProjectTypeVersion | null;
  },

  async createVersion(
    projectTypeId: string,
    payload: CreateVersionPayload,
  ): Promise<ProjectTypeVersion> {
    const res = await api.post(`/project-types/${projectTypeId}/versions`, payload);
    return unwrapItem(res) as ProjectTypeVersion;
  },

  async getVersion(versionId: string): Promise<ProjectTypeVersion> {
    const res = await api.get(`/project-types/versions/${versionId}`);
    return unwrapItem(res) as ProjectTypeVersion;
  },
};
