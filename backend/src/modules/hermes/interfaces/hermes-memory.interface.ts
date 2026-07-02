import type { HermesMemoryType } from '@prisma/client';

/**
 * IHermesMemory — Agent personal memory management
 * SRP: stores, retrieves, and manages Hermes agent personal memory layers.
 * Distinct from global MemoryEntry — this is agent-specific.
 */
export interface IHermesMemory {
  store(
    input: StoreMemoryInput,
    tenantId: string,
  ): Promise<HermesMemoryEntryDescriptor>;
  search(
    agentId: string,
    query: string,
    tenantId: string,
    opts?: MemorySearchOpts,
  ): Promise<HermesMemoryEntryDescriptor[]>;
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
  forget(agentId: string, memoryId: string, tenantId: string): Promise<void>;
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
  getStats(agentId: string, tenantId: string): Promise<HermesMemoryStats>;
  purgeExpired(tenantId?: string): Promise<number>;
}

export interface StoreMemoryInput {
  hermesAgentId: string;
  type: HermesMemoryType;
  content: string;
  summary?: string;
  importance?: number;
  source?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  workspaceId?: string;
}

export interface HermesMemoryEntryDescriptor {
  id: string;
  hermesAgentId: string;
  tenantId: string;
  workspaceId?: string;
  type: HermesMemoryType;
  content: string;
  summary?: string;
  importance: number;
  source?: string;
  metadata?: Record<string, unknown>;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface MemorySearchOpts {
  type?: HermesMemoryType;
  limit?: number;
  minImportance?: number;
  workspaceId?: string;
}

export interface HermesMemoryStats {
  personal: number;
  episodic: number;
  procedural: number;
  total: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}
