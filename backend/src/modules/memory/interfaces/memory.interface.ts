import type { MemoryType } from '@prisma/client';

export interface CreateMemoryInput {
  type: MemoryType;
  content: string;
  summary?: string;
  importance?: number;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
  agentId?: string;
  tenantId: string;
}

export interface MemorySearchInput {
  tenantId: string;
  agentId?: string;
  query: string;
  type?: MemoryType;
  limit?: number;
}

export interface IMemoryService {
  store(input: CreateMemoryInput): Promise<unknown>;
  search(input: MemorySearchInput): Promise<unknown[]>;
  findByAgent(
    agentId: string,
    tenantId: string,
    limit?: number,
  ): Promise<unknown[]>;
  purgeExpired(): Promise<number>;
}

export const MEMORY_SERVICE = Symbol('MEMORY_SERVICE');
