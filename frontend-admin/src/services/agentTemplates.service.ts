/**
 * agentTemplates.service.ts
 *
 * SRP: Encapsulates all HTTP calls to the /api/v1/agent-templates/platform
 *      endpoint. Components stay free of Axios / API knowledge.
 */

import api from './api';
import { unwrapItem, unwrapList } from './unwrap';

export interface AgentTemplate {
  id: string;
  name: string;
  description?: string;
  type: 'CORE' | 'FUNCTIONAL' | 'EXECUTIVE' | 'META';
  model: string;
  systemPrompt?: string;
  instructions?: string;
  permissions: string[];
  config: Record<string, unknown>;
  isPublic: boolean;
  version: string;
  tenantId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgentTemplatePayload {
  name: string;
  description?: string;
  type?: AgentTemplate['type'];
  model?: string;
  systemPrompt?: string;
  instructions?: string;
  permissions?: string[];
  config?: Record<string, unknown>;
  version?: string;
}

export type UpdateAgentTemplatePayload = Partial<CreateAgentTemplatePayload>;

export const agentTemplatesService = {
  /** List all platform-wide (SuperAdmin) agent templates */
  async list(opts?: { type?: string; page?: number; limit?: number }) {
    const params: Record<string, unknown> = {};
    if (opts?.type) params.type = opts.type;
    if (opts?.page) params.page = opts.page;
    if (opts?.limit) params.limit = opts.limit;
    const res = await api.get('/agent-templates/platform', { params });
    return unwrapList(res) as { items: AgentTemplate[]; total: number; totalPages: number };
  },

  async get(id: string): Promise<AgentTemplate> {
    const res = await api.get(`/agent-templates/platform/${id}`);
    return unwrapItem(res) as AgentTemplate;
  },

  async create(payload: CreateAgentTemplatePayload): Promise<AgentTemplate> {
    const res = await api.post('/agent-templates/platform', payload);
    return unwrapItem(res) as AgentTemplate;
  },

  async update(id: string, payload: UpdateAgentTemplatePayload): Promise<AgentTemplate> {
    const res = await api.patch(`/agent-templates/platform/${id}`, payload);
    return unwrapItem(res) as AgentTemplate;
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/agent-templates/platform/${id}`);
  },
};
