/**
 * Projects Module - Interface Definitions
 *
 * Following SOLID:
 * - Interface Segregation: Focused interfaces for repository patterns
 * - Dependency Inversion: Module depends on abstractions
 */

// ─── Inline Type Definition ───────────────────────────────────────────────────
// Project type defined inline to avoid Prisma client issues before generate
// This will match the schema.prisma Project model

export type ProjectType = 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

/**
 * Project entity type
 * Maps to Prisma Project model
 */
export type Project = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  goalIds: string[];
  departmentId: string | null;
  targetDate: Date | null;
  metadata: unknown;
  createdAt: Date;
  updatedAt: Date;
};

// ============ Repository Types ============

export interface CreateProjectInput {
  name: string;
  description?: string;
  departmentId?: string;
  targetDate?: Date;
  goalIds?: string[];
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectType;
  departmentId?: string;
  targetDate?: Date;
  goalIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ListProjectsOptions {
  status?: ProjectType;
  departmentId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface IProjectRepository {
  create(data: CreateProjectInput, tenantId: string): Promise<Project>;
  findById(id: string, tenantId: string): Promise<Project | null>;
  findAll(
    options: ListProjectsOptions,
    tenantId: string,
  ): Promise<{ data: Project[]; total: number }>;
  findByDepartment(departmentId: string, tenantId: string): Promise<Project[]>;
  update(
    id: string,
    data: UpdateProjectInput,
  ): Promise<Project>;
  delete(id: string, tenantId: string): Promise<void>;
  addGoal(projectId: string, goalId: string, tenantId: string): Promise<Project>;
  removeGoal(projectId: string, goalId: string, tenantId: string): Promise<Project>;
}

// ============ Service Types ============

export interface ProjectWithRelations extends Project {
  department?: {
    id: string;
    name: string;
  } | null;
  goals?: Array<{
    id: string;
    title: string;
    progress: number;
  }>;
}

export interface ProjectStats {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  archivedProjects: number;
  projectsByDepartment: Array<{
    departmentId: string | null;
    departmentName: string | null;
    count: number;
  }>;
}

// ============ Controller Types ============

export interface CreateProjectDto {
  name: string;
  description?: string;
  departmentId?: string;
  targetDate?: string;
  goalIds?: string[];
}

export interface UpdateProjectDto {
  name?: string;
  description?: string;
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  departmentId?: string;
  targetDate?: string;
  goalIds?: string[];
  metadata?: Record<string, unknown>;
}

export interface ListProjectsDto {
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';
  departmentId?: string;
  search?: string;
  page?: string;
  limit?: string;
}

// Export token for DI
export const PROJECT_REPOSITORY = 'PROJECT_REPOSITORY';
