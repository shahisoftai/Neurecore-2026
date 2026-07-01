import type { AgentStatus, AgentType } from '@prisma/client';

// ─────────────────────────────────────────────────────────────
// Domain types
// ─────────────────────────────────────────────────────────────

export interface AgentConfig {
  model: string;
  systemPrompt?: string;
  instructions?: string;
  budgetPerDay?: number;
  permissions: string[];
}

export interface CreateAgentInput {
  name: string;
  description?: string;
  type?: AgentType;
  model?: string;
  systemPrompt?: string;
  instructions?: string;
  budgetPerDay?: number;
  permissions?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateAgentInput {
  name?: string;
  description?: string;
  status?: AgentStatus;
  model?: string;
  systemPrompt?: string;
  instructions?: string;
  budgetPerDay?: number;
  permissions?: string[];
  config?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  isActive?: boolean;
  // WS-3.3 / WS-5 — per-agent integration identity
  emailAlias?: string;
  emailProvider?: string;
  emailDisplayName?: string;
  emailSignature?: string;
  googleDriveFolderId?: string | null;
}

export interface AgentFilter {
  departmentId?: string;
  status?: AgentStatus;
  type?: AgentType;
  isActive?: boolean;
  page?: number;
  limit?: number;
}

// ─────────────────────────────────────────────────────────────
// Interface: IAgentService  (SOLID ISP / DIP)
// ─────────────────────────────────────────────────────────────

export interface IAgentService {
  findAll(filter: AgentFilter, tenantId: string): Promise<{
    data: unknown[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }>;
  findOne(id: string, tenantId: string): Promise<unknown>;
  create(
    input: CreateAgentInput,
    userId: string,
    tenantId: string,
  ): Promise<unknown>;
  update(
    id: string,
    input: UpdateAgentInput,
    tenantId: string,
  ): Promise<unknown>;
  remove(id: string, tenantId: string): Promise<void>;
  updateStatus(
    id: string,
    status: AgentStatus,
    tenantId: string,
  ): Promise<unknown>;
  setStatus(
    id: string,
    status: AgentStatus,
    tenantId: string,
  ): Promise<unknown>;
}

export const AGENT_SERVICE = Symbol('AGENT_SERVICE');
