import type { HermesMemoryType, HermesMemoryEntry } from '@prisma/client';

export interface HermesMemoryInput {
  hermesAgentId: string;
  tenantId: string;
  type: HermesMemoryType;
  content: string;
  summary?: string;
  importance?: number;
  source?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  workspaceId?: string;
}

export interface MemorySearchOptions {
  limit?: number;
  type?: HermesMemoryType;
  minImportance?: number;
}

export interface IHermesMemory {
  store(input: HermesMemoryInput): Promise<HermesMemoryEntry>;
  search(
    agentId: string,
    query: string,
    tenantId: string,
    options?: MemorySearchOptions,
  ): Promise<HermesMemoryEntry[]>;
  getContext(
    agentId: string,
    tenantId: string,
    limit?: number,
  ): Promise<string>;
  rememberEpisode(
    agentId: string,
    tenantId: string,
    episode: string,
    metadata?: Record<string, unknown>,
  ): Promise<void>;
  forget(
    agentId: string,
    memoryId: string,
    tenantId: string,
  ): Promise<void>;
  getProceduralMemory(
    agentId: string,
    task: string,
    tenantId: string,
  ): Promise<string | null>;
  storeProceduralMemory(
    agentId: string,
    tenantId: string,
    task: string,
    procedure: string,
  ): Promise<void>;
  cleanupExpired(tenantId: string): Promise<number>;
  getMemoryStats(
    agentId: string,
    tenantId: string,
  ): Promise<{
    shortTerm: number;
    longTerm: number;
    episodic: number;
  }>;
}
