/**
 * project-memory module — Interface Definitions
 *
 * Phase 5: Project Memory + Decision Registry
 * Append-only institutional knowledge.
 *
 * SOLID: Interface Segregation, Dependency Inversion.
 */

export type MemoryCategory =
  | 'NOTE'
  | 'INSIGHT'
  | 'CONSTRAINT'
  | 'RISK'
  | 'OPPORTUNITY'
  | 'LESSON';

export type AuthorType = 'HUMAN' | 'AI' | 'SYSTEM';

export type ProjectMemory = {
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
  confidence: number | null;
  supersededBy: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

export interface CreateMemoryInput {
  projectId: string;
  authorId?: string;
  authorType?: AuthorType;
  category?: MemoryCategory;
  content: string;
  sourceEntityType?: string;
  sourceEntityId?: string;
  isPinned?: boolean;
  isAiGenerated?: boolean;
  confidence?: number;
  metadata?: Record<string, unknown>;
}

export interface UpdateMemoryInput {
  content?: string;
  category?: MemoryCategory;
  isPinned?: boolean;
  supersededBy?: string | null;
}

export interface ListMemoriesOptions {
  projectId?: string;
  authorId?: string;
  category?: MemoryCategory;
  sourceEntityId?: string;
  search?: string; // ILKE search on content
  page?: number;
  limit?: number;
}

export interface ISearchMemoriesResult {
  memories: ProjectMemory[];
  total: number;
}

export interface IProjectMemoryRepository {
  create(data: CreateMemoryInput): Promise<ProjectMemory>;
  findById(id: string, tenantId: string): Promise<ProjectMemory | null>;
  findAll(options: ListMemoriesOptions, tenantId: string): Promise<{ data: ProjectMemory[]; total: number }>;
  update(id: string, tenantId: string, data: UpdateMemoryInput): Promise<ProjectMemory>;
  supersede(id: string, supersededById: string): Promise<void>;
  search(projectId: string, query: string, tenantId: string): Promise<ProjectMemory[]>;
  updateConfidence(id: string, tenantId: string, confidence: number, supersededById?: string | null): Promise<ProjectMemory>;
}

