/**
 * Goals Module - Interface Segregation
 *
 * Following SOLID principles:
 * - Single Responsibility: Each interface has ONE purpose
 * - Interface Segregation: Small, focused interfaces
 * - Dependency Inversion: Depend on abstractions, not concretions
 */

// ─── Prisma Type Import ───────────────────────────────────────────────────────
// Goal type will be available after prisma generate
// Using inline type for now to avoid circular dependency issues

export type Goal = {
  id: string;
  tenantId: string;
  title: string;
  description: string | null;
  level: 'COMPANY' | 'DEPARTMENT' | 'TEAM' | 'INDIVIDUAL';
  status: 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';
  progress: number;
  parentId: string | null;
  ownerAgentId: string | null;
  ownerUserId: string | null;
  departmentId: string | null;
  targetDate: Date | null;
  completedAt: Date | null;
  metrics: unknown;
  // Phase 3 — Project linkage
  projectId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type GoalLevel = 'COMPANY' | 'DEPARTMENT' | 'TEAM' | 'INDIVIDUAL';
export type GoalStatus = 'ACTIVE' | 'COMPLETED' | 'PAUSED' | 'ARCHIVED';

// ─── Input Types ─────────────────────────────────────────────────────────────

export interface CreateGoalInput {
  title: string;
  description?: string;
  level?: GoalLevel;
  parentId?: string;
  ownerAgentId?: string;
  ownerUserId?: string;
  departmentId?: string;
  targetDate?: Date;
  // Phase 3
  projectId?: string;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string;
  level?: GoalLevel;
  status?: GoalStatus;
  progress?: number;
  parentId?: string | null;
  ownerAgentId?: string | null;
  ownerUserId?: string | null;
  departmentId?: string | null;
  targetDate?: Date | null;
  completedAt?: Date | null;
}

export interface ListGoalsOptions {
  status?: GoalStatus;
  level?: GoalLevel;
  parentId?: string | null;
  ownerUserId?: string;
  ownerAgentId?: string;
  projectId?: string;
  page?: number;
  limit?: number;
}

// ─── Repository Interface ─────────────────────────────────────────────────────

/**
 * Repository interface for Goal persistence
 * Single Responsibility: Only handles Goal CRUD
 * Liskov Substitution: Any implementation can be swapped
 */
export interface IGoalRepository {
  create(data: CreateGoalInput, tenantId: string): Promise<Goal>;
  findById(id: string, tenantId: string): Promise<Goal | null>;
  findAll(options: ListGoalsOptions, tenantId: string): Promise<{ data: Goal[]; total: number }>;
  findByParentId(parentId: string, tenantId: string): Promise<Goal[]>;
  findRootGoals(tenantId: string): Promise<Goal[]>;
  findByProjectId(projectId: string, tenantId: string): Promise<Goal[]>;
  update(id: string, data: UpdateGoalInput): Promise<Goal>;
  delete(id: string, tenantId: string): Promise<void>;
  updateProgress(id: string, progress: number): Promise<Goal>;
}

// ─── Service Types ────────────────────────────────────────────────────────────

export interface GoalTreeNode {
  goal: Goal;
  children: GoalTreeNode[];
}

export interface GoalWithChildren extends Goal {
  children: Goal[];
}
