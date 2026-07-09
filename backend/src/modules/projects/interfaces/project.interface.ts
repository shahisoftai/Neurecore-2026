/**
 * Projects Module — Interface Definitions
 *
 * Following SOLID:
 * - Interface Segregation: focused interfaces for repository patterns
 * - Dependency Inversion: module depends on abstractions
 */

export type { ProjectStatus } from '../common/project-lifecycle';

export type BudgetType = 'FIXED_FEE' | 'HOURLY' | 'RETAINER';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

/**
 * Project entity type — mirrors the Prisma Project model after Phase 1 migration.
 */
export type Project = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  status: import('../common/project-lifecycle').ProjectStatus;

  customerId: string | null;
  projectTypeId: string | null;
  projectTypeVersion: number | null;

  budgetType: BudgetType | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;

  goalIds: string[];
  departmentId: string | null;

  parentProjectId: string | null;
  clonedFromProjectId: string | null;

  lostReason: string | null;
  customFieldValues: Record<string, unknown> | null;

  targetDate: Date | null;
  startDate: Date | null;
  completedAt: Date | null;

  priority: Priority | null;
  tags: string[];
  metadata: unknown;

  createdAt: Date;
  updatedAt: Date;
};

// ─── Repository / Service Inputs ──────────────────────────────────────────────

export interface CreateProjectInput {
  name: string;
  description?: string;
  customerId?: string | null;
  projectTypeId?: string | null;
  projectTypeVersion?: number | null;
  budgetType?: BudgetType | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  departmentId?: string | null;
  targetDate?: Date | string | null;
  startDate?: Date | string | null;
  priority?: Priority | null;
  tags?: string[];
  goalIds?: string[];
  metadata?: Record<string, unknown>;
  customFieldValues?: Record<string, unknown> | null;
  clonedFromProjectId?: string | null;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  customerId?: string | null;
  projectTypeId?: string | null;
  projectTypeVersion?: number | null;
  budgetType?: BudgetType | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  departmentId?: string | null;
  targetDate?: Date | string | null;
  startDate?: Date | string | null;
  priority?: Priority | null;
  tags?: string[];
  goalIds?: string[];
  metadata?: Record<string, unknown>;
  customFieldValues?: Record<string, unknown> | null;
  lostReason?: string | null;
}

export interface ListProjectsOptions {
  status?: import('../common/project-lifecycle').ProjectStatus;
  departmentId?: string;
  customerId?: string;
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
    tenantId: string,
    data: UpdateProjectInput,
  ): Promise<Project>;
  /** Atomic status transition — must be the only path to mutate `status`. */
  setStatus(
    id: string,
    tenantId: string,
    status: import('../common/project-lifecycle').ProjectStatus,
    extras?: { lostReason?: string | null; completedAt?: Date | null },
  ): Promise<Project>;
  delete(id: string, tenantId: string): Promise<void>;
  addGoal(
    projectId: string,
    goalId: string,
    tenantId: string,
  ): Promise<Project>;
  removeGoal(
    projectId: string,
    goalId: string,
    tenantId: string,
  ): Promise<Project>;
  createStages(
    projectId: string,
    stages: Array<{ name: string; order: number; description?: string }>,
  ): Promise<void>;
  cloneFromProject(
    sourceProjectId: string,
    newName: string,
    tenantId: string,
  ): Promise<Project>;
}

export interface ProjectWithRelations extends Project {
  department?: { id: string; name: string } | null;
  customer?: { id: string; name: string } | null;
  goals?: Array<{ id: string; title: string; progress: number }>;
}

export const PROJECT_REPOSITORY = 'PROJECT_REPOSITORY';
