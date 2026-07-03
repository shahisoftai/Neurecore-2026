/**
 * NeureCore Agent Tools — P1 Expansion
 *
 * 66 tools across: Department, Agent, Project, Task, Approval,
 * Budget, Company, Roles, Notifications, Reporting, Inbox.
 *
 * Pattern: @Injectable() extending BaseStructuredTool with Zod input schema.
 */

import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { BaseStructuredTool } from '../structured-tool.base';
import {
  ToolCategory,
  StructuredToolResult,
  ToolExecutionContext,
} from '../interfaces/structured-tool.interface';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

// ─── Enums (matching Prisma schema) ────────────────────────────────────────

const TaskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const TaskStatusEnum = z.enum(['PENDING', 'QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);
const AgentStatusEnum = z.enum(['IDLE', 'RUNNING', 'PAUSED', 'ERROR', 'TERMINATED', 'ARCHIVED', 'DEPRECATED']);
const DepartmentStatusEnum = z.enum(['ACTIVE', 'INACTIVE']);
const ProjectStatusEnum = z.enum(['ACTIVE', 'COMPLETED', 'ARCHIVED']);
const ApprovalStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'EXPIRED']);
const ApprovalPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

// ═══════════════════════════════════════════════════════════════════════════
// INPUT SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

// ─── P0 Schemas (corrected URGENT → CRITICAL) ───────────────────────────

export const CreateTaskInputSchema = z.object({
  title: z.string().min(1).describe('Task title (required)'),
  description: z.string().optional().describe('Task description'),
  departmentId: z.string().optional().describe('Department ID'),
  agentId: z.string().optional().describe('Agent ID to assign'),
  priority: TaskPriorityEnum.default('MEDIUM').optional(),
});
export type CreateTaskInput = z.infer<typeof CreateTaskInputSchema>;

export const CreateProjectInputSchema = z.object({
  name: z.string().min(1).describe('Project name (required)'),
  description: z.string().optional().describe('Project description'),
  departmentId: z.string().optional().describe('Department ID'),
  goalIds: z.array(z.string()).optional().describe('Related goal IDs'),
  targetDate: z.string().optional().describe('Target date (ISO 8601)'),
});
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;

export const ListDepartmentsInputSchema = z.object({
  status: DepartmentStatusEnum.default('ACTIVE').optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListDepartmentsInput = z.infer<typeof ListDepartmentsInputSchema>;

export const ListAgentsInputSchema = z.object({
  departmentId: z.string().optional(),
  status: AgentStatusEnum.optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListAgentsInput = z.infer<typeof ListAgentsInputSchema>;

export const PauseAgentInputSchema = z.object({ agentId: z.string() });
export type PauseAgentInput = z.infer<typeof PauseAgentInputSchema>;

export const ResumeAgentInputSchema = z.object({ agentId: z.string() });
export type ResumeAgentInput = z.infer<typeof ResumeAgentInputSchema>;

export const ListTasksInputSchema = z.object({
  status: TaskStatusEnum.optional(),
  agentId: z.string().optional(),
  departmentId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListTasksInput = z.infer<typeof ListTasksInputSchema>;

export const GetTenantSnapshotInputSchema = z.object({});
export type GetTenantSnapshotInput = z.infer<typeof GetTenantSnapshotInputSchema>;

// ─── P1: Department Schemas ─────────────────────────────────────────────

export const UpdateDepartmentInputSchema = z.object({
  departmentId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});
export type UpdateDepartmentInput = z.infer<typeof UpdateDepartmentInputSchema>;

export const ArchiveDepartmentInputSchema = z.object({ departmentId: z.string() });
export type ArchiveDepartmentInput = z.infer<typeof ArchiveDepartmentInputSchema>;

export const DeleteDepartmentInputSchema = z.object({ departmentId: z.string() });
export type DeleteDepartmentInput = z.infer<typeof DeleteDepartmentInputSchema>;

export const AssignManagerInputSchema = z.object({
  departmentId: z.string(),
  agentId: z.string(),
});
export type AssignManagerInput = z.infer<typeof AssignManagerInputSchema>;

export const UnassignManagerInputSchema = z.object({ departmentId: z.string() });
export type UnassignManagerInput = z.infer<typeof UnassignManagerInputSchema>;

// ─── P1: Agent Schemas ────────────────────────────────────────────────────

export const GetAgentInputSchema = z.object({ agentId: z.string() });
export type GetAgentInput = z.infer<typeof GetAgentInputSchema>;

export const UpdateAgentInputSchema = z.object({
  agentId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: AgentStatusEnum.optional(),
  model: z.string().optional(),
  systemPrompt: z.string().optional(),
});
export type UpdateAgentInput = z.infer<typeof UpdateAgentInputSchema>;

export const ArchiveAgentInputSchema = z.object({ agentId: z.string() });
export type ArchiveAgentInput = z.infer<typeof ArchiveAgentInputSchema>;

export const AssignAgentToDepartmentInputSchema = z.object({
  agentId: z.string(),
  departmentId: z.string(),
});
export type AssignAgentToDepartmentInput = z.infer<typeof AssignAgentToDepartmentInputSchema>;

export const RemoveAgentFromProjectInputSchema = z.object({
  agentId: z.string(),
  projectId: z.string(),
});
export type RemoveAgentFromProjectInput = z.infer<typeof RemoveAgentFromProjectInputSchema>;

export const BulkCreateAgentsInputSchema = z.object({
  agents: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(['CORE', 'FUNCTIONAL', 'EXECUTIVE', 'META']).default('FUNCTIONAL'),
    model: z.string().optional(),
    departmentId: z.string().optional(),
    description: z.string().optional(),
  })).min(1).max(50),
});
export type BulkCreateAgentsInput = z.infer<typeof BulkCreateAgentsInputSchema>;

export const BulkAssignToDepartmentInputSchema = z.object({
  agentIds: z.array(z.string()).min(1).max(100),
  departmentId: z.string(),
});
export type BulkAssignToDepartmentInput = z.infer<typeof BulkAssignToDepartmentInputSchema>;

export const GetAgentWorkloadInputSchema = z.object({ agentId: z.string() });
export type GetAgentWorkloadInput = z.infer<typeof GetAgentWorkloadInputSchema>;

// ─── P1: Project Schemas ──────────────────────────────────────────────────

export const GetProjectInputSchema = z.object({ projectId: z.string() });
export type GetProjectInput = z.infer<typeof GetProjectInputSchema>;

export const UpdateProjectInputSchema = z.object({
  projectId: z.string(),
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: ProjectStatusEnum.optional(),
  targetDate: z.string().optional(),
});
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;

export const ArchiveProjectInputSchema = z.object({ projectId: z.string() });
export type ArchiveProjectInput = z.infer<typeof ArchiveProjectInputSchema>;

export const DeleteProjectInputSchema = z.object({ projectId: z.string() });
export type DeleteProjectInput = z.infer<typeof DeleteProjectInputSchema>;

export const CloneProjectInputSchema = z.object({
  projectId: z.string(),
  newName: z.string().min(1),
  includeTasks: z.boolean().default(false).optional(),
});
export type CloneProjectInput = z.infer<typeof CloneProjectInputSchema>;

// ─── P1: Task Schemas ─────────────────────────────────────────────────────

export const GetTaskInputSchema = z.object({ taskId: z.string() });
export type GetTaskInput = z.infer<typeof GetTaskInputSchema>;

export const UpdateTaskInputSchema = z.object({
  taskId: z.string(),
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  priority: TaskPriorityEnum.optional(),
  status: TaskStatusEnum.optional(),
});
export type UpdateTaskInput = z.infer<typeof UpdateTaskInputSchema>;

export const DeleteTaskInputSchema = z.object({ taskId: z.string() });
export type DeleteTaskInput = z.infer<typeof DeleteTaskInputSchema>;

export const AssignTaskInputSchema = z.object({ taskId: z.string(), agentId: z.string() });
export type AssignTaskInput = z.infer<typeof AssignTaskInputSchema>;

export const UnassignTaskInputSchema = z.object({ taskId: z.string() });
export type UnassignTaskInput = z.infer<typeof UnassignTaskInputSchema>;

export const MarkTaskCompleteInputSchema = z.object({ taskId: z.string() });
export type MarkTaskCompleteInput = z.infer<typeof MarkTaskCompleteInputSchema>;

export const MarkTaskInProgressInputSchema = z.object({ taskId: z.string() });
export type MarkTaskInProgressInput = z.infer<typeof MarkTaskInProgressInputSchema>;

export const ReopenTaskInputSchema = z.object({ taskId: z.string() });
export type ReopenTaskInput = z.infer<typeof ReopenTaskInputSchema>;

export const ChangeTaskPriorityInputSchema = z.object({
  taskId: z.string(),
  priority: TaskPriorityEnum,
});
export type ChangeTaskPriorityInput = z.infer<typeof ChangeTaskPriorityInputSchema>;

export const AddSubtaskInputSchema = z.object({
  parentTaskId: z.string(),
  title: z.string().min(1),
  priority: TaskPriorityEnum.default('MEDIUM').optional(),
  agentId: z.string().optional(),
});
export type AddSubtaskInput = z.infer<typeof AddSubtaskInputSchema>;

export const ListSubtasksInputSchema = z.object({ parentTaskId: z.string() });
export type ListSubtasksInput = z.infer<typeof ListSubtasksInputSchema>;

export const GetMyTasksInputSchema = z.object({
  status: TaskStatusEnum.optional(),
  priority: TaskPriorityEnum.optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type GetMyTasksInput = z.infer<typeof GetMyTasksInputSchema>;

export const GetOverdueTasksInputSchema = z.object({
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type GetOverdueTasksInput = z.infer<typeof GetOverdueTasksInputSchema>;

export const BulkAssignTasksInputSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  agentId: z.string(),
});
export type BulkAssignTasksInput = z.infer<typeof BulkAssignTasksInputSchema>;

export const BulkChangeStatusInputSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  status: TaskStatusEnum,
});
export type BulkChangeStatusInput = z.infer<typeof BulkChangeStatusInputSchema>;

export const CloneTaskInputSchema = z.object({
  taskId: z.string(),
  newAssigneeId: z.string().optional(),
});
export type CloneTaskInput = z.infer<typeof CloneTaskInputSchema>;

// ─── P1: Approval Schemas ────────────────────────────────────────────────

export const ListPendingApprovalsInputSchema = z.object({
  departmentId: z.string().optional(),
  priority: ApprovalPriorityEnum.optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListPendingApprovalsInput = z.infer<typeof ListPendingApprovalsInputSchema>;

export const GetApprovalInputSchema = z.object({ approvalId: z.string() });
export type GetApprovalInput = z.infer<typeof GetApprovalInputSchema>;

export const ApproveRequestInputSchema = z.object({
  approvalId: z.string(),
  comment: z.string().optional(),
});
export type ApproveRequestInput = z.infer<typeof ApproveRequestInputSchema>;

export const RejectRequestInputSchema = z.object({
  approvalId: z.string(),
  reason: z.string().min(1),
});
export type RejectRequestInput = z.infer<typeof RejectRequestInputSchema>;

export const BulkApproveInputSchema = z.object({
  approvalIds: z.array(z.string()).min(1).max(50),
  comment: z.string().optional(),
});
export type BulkApproveInput = z.infer<typeof BulkApproveInputSchema>;

export const BulkRejectInputSchema = z.object({
  approvalIds: z.array(z.string()).min(1).max(50),
  reason: z.string().min(1),
});
export type BulkRejectInput = z.infer<typeof BulkRejectInputSchema>;

export const CreateApprovalRequestInputSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  resourceType: z.string().min(1),
  resourceId: z.string().optional(),
  priority: ApprovalPriorityEnum.default('MEDIUM').optional(),
});
export type CreateApprovalRequestInput = z.infer<typeof CreateApprovalRequestInputSchema>;

export const GetMyPendingApprovalsInputSchema = z.object({
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type GetMyPendingApprovalsInput = z.infer<typeof GetMyPendingApprovalsInputSchema>;

export const ResubmitApprovalInputSchema = z.object({ approvalId: z.string() });
export type ResubmitApprovalInput = z.infer<typeof ResubmitApprovalInputSchema>;

export const CancelApprovalRequestInputSchema = z.object({ approvalId: z.string() });
export type CancelApprovalRequestInput = z.infer<typeof CancelApprovalRequestInputSchema>;

// ─── P1: Budget/Cost Schemas ───────────────────────────────────────────────

export const GetCostReportInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
  groupBy: z.enum(['day', 'week', 'month']).default('day').optional(),
});
export type GetCostReportInput = z.infer<typeof GetCostReportInputSchema>;

export const GetCostByDepartmentInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type GetCostByDepartmentInput = z.infer<typeof GetCostByDepartmentInputSchema>;

export const GetCostByAgentInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type GetCostByAgentInput = z.infer<typeof GetCostByAgentInputSchema>;

export const GetCostByProjectInputSchema = z.object({
  fromDate: z.string().optional(),
  toDate: z.string().optional(),
});
export type GetCostByProjectInput = z.infer<typeof GetCostByProjectInputSchema>;

export const SetBudgetAlertInputSchema = z.object({
  departmentId: z.string().optional(),
  thresholdPercent: z.number().min(1).max(100),
  email: z.string().email().optional(),
});
export type SetBudgetAlertInput = z.infer<typeof SetBudgetAlertInputSchema>;

export const GetTodayCostInputSchema = z.object({});
export type GetTodayCostInput = z.infer<typeof GetTodayCostInputSchema>;

// ─── P1: Company Settings Schemas ─────────────────────────────────────────

export const GetCompanyProfileInputSchema = z.object({});
export type GetCompanyProfileInput = z.infer<typeof GetCompanyProfileInputSchema>;

export const UpdateCompanyProfileInputSchema = z.object({
  name: z.string().min(1).optional(),
  logoUrl: z.string().url().optional(),
  website: z.string().url().optional(),
  industry: z.string().optional(),
});
export type UpdateCompanyProfileInput = z.infer<typeof UpdateCompanyProfileInputSchema>;

export const GetTenantSettingsInputSchema = z.object({});
export type GetTenantSettingsInput = z.infer<typeof GetTenantSettingsInputSchema>;

// ─── P1: Notification Schemas ─────────────────────────────────────────────

export const GetMyNotificationsInputSchema = z.object({
  limit: z.number().int().positive().max(100).default(20).optional(),
  isRead: z.boolean().optional(),
});
export type GetMyNotificationsInput = z.infer<typeof GetMyNotificationsInputSchema>;

export const MarkNotificationReadInputSchema = z.object({ notificationId: z.string() });
export type MarkNotificationReadInput = z.infer<typeof MarkNotificationReadInputSchema>;

export const MarkAllNotificationsReadInputSchema = z.object({});
export type MarkAllNotificationsReadInput = z.infer<typeof MarkAllNotificationsReadInputSchema>;

// ─── P1: Reporting Schemas ────────────────────────────────────────────────

export const GetDashboardSummaryInputSchema = z.object({});
export type GetDashboardSummaryInput = z.infer<typeof GetDashboardSummaryInputSchema>;

export const GetOverdueTaskReportInputSchema = z.object({
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
  limit: z.number().int().positive().max(100).default(50).optional(),
});
export type GetOverdueTaskReportInput = z.infer<typeof GetOverdueTaskReportInputSchema>;

// ─── P1: Inbox Schemas ────────────────────────────────────────────────────

export const GetInboxSummaryInputSchema = z.object({});
export type GetInboxSummaryInput = z.infer<typeof GetInboxSummaryInputSchema>;

export const ListInboxItemsInputSchema = z.object({
  type: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().int().positive().max(100).default(20).optional(),
});
export type ListInboxItemsInput = z.infer<typeof ListInboxItemsInputSchema>;

export const GetInboxItemInputSchema = z.object({ itemId: z.string() });
export type GetInboxItemInput = z.infer<typeof GetInboxItemInputSchema>;

export const RespondToInboxItemInputSchema = z.object({
  itemId: z.string(),
  action: z.enum(['approve', 'reject', 'respond']),
  comment: z.string().optional(),
});
export type RespondToInboxItemInput = z.infer<typeof RespondToInboxItemInputSchema>;

// ═══════════════════════════════════════════════════════════════════════════
// P0 TOOL IMPLEMENTATIONS (corrected URGENT → CRITICAL)
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class CreateTaskTool extends BaseStructuredTool {
  readonly name = 'createTask';
  readonly description = 'Create a new task. Use when user asks to create, add, or register a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CreateTaskInputSchema;
  readonly requiredPermissions = ['task:create'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: CreateTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.prisma.task.create({
        data: {
          title: input.title,
          description: input.description,
          priority: input.priority ?? 'MEDIUM',
          tenantId: context.tenantId as string,
          agentId: input.agentId ?? null,
          createdById: (context.userId as string) ?? null,
          status: 'PENDING',
          input: {},
        },
      });
      return { success: true, data: { taskId: task.id, title: task.title, status: task.status, priority: task.priority, createdAt: task.createdAt.toISOString() }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create task' };
    }
  }
}

@Injectable()
export class CreateProjectTool extends BaseStructuredTool {
  readonly name = 'createProject';
  readonly description = 'Create a new project. Use when user asks to create, add, or register a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CreateProjectInputSchema;
  readonly requiredPermissions = ['project:create'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: CreateProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.prisma.project.create({
        data: {
          name: input.name,
          description: input.description,
          tenantId: context.tenantId as string,
          departmentId: input.departmentId ?? null,
          goalIds: input.goalIds ?? [],
          targetDate: input.targetDate ? new Date(input.targetDate) : null,
          status: 'ACTIVE',
        },
      });
      return { success: true, data: { projectId: project.id, name: project.name, status: project.status, createdAt: project.createdAt.toISOString() }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create project' };
    }
  }
}

@Injectable()
export class ListDepartmentsTool extends BaseStructuredTool {
  readonly name = 'listDepartments';
  readonly description = 'List departments. Use when user asks about departments or needs department IDs.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListDepartmentsInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ListDepartmentsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const departments = await this.prisma.department.findMany({
        where: { tenantId: context.tenantId as string, status: input.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' },
        take: input.limit ?? 20,
        select: { id: true, name: true, description: true, status: true, _count: { select: { agents: true, members: true } } },
      });
      return { success: true, data: { departments: departments.map(d => ({ id: d.id, name: d.name, description: d.description, status: d.status, agentCount: d._count.agents, memberCount: d._count.members })), total: departments.length }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list departments' };
    }
  }
}

@Injectable()
export class ListAgentsTool extends BaseStructuredTool {
  readonly name = 'listAgents';
  readonly description = 'List AI agents. Use when user asks about agents, their status, or wants to see available agents.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListAgentsInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ListAgentsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.departmentId) where.departmentId = input.departmentId;
      if (input.status) where.status = input.status;
      const agents = await this.prisma.agent.findMany({ where, take: input.limit ?? 20, select: { id: true, name: true, type: true, status: true, departmentId: true } });
      return { success: true, data: { agents: agents.map(a => ({ id: a.id, name: a.name, type: a.type, status: a.status, departmentId: a.departmentId })), total: agents.length }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list agents' };
    }
  }
}

@Injectable()
export class PauseAgentTool extends BaseStructuredTool {
  readonly name = 'pauseAgent';
  readonly description = 'Pause an AI agent. Use when user asks to pause, stop, or deactivate an agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = PauseAgentInputSchema;
  readonly requiredPermissions = ['agent:pause'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: PauseAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      await this.prisma.agent.update({ where: { id: input.agentId }, data: { status: 'PAUSED' } });
      return { success: true, data: { agentId: agent.id, name: agent.name, previousStatus: agent.status, newStatus: 'PAUSED' }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to pause agent' };
    }
  }
}

@Injectable()
export class ResumeAgentTool extends BaseStructuredTool {
  readonly name = 'resumeAgent';
  readonly description = 'Resume a paused AI agent. Use when user asks to resume, start, or reactivate an agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ResumeAgentInputSchema;
  readonly requiredPermissions = ['agent:resume'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ResumeAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      await this.prisma.agent.update({ where: { id: input.agentId }, data: { status: 'RUNNING' } });
      return { success: true, data: { agentId: agent.id, name: agent.name, previousStatus: agent.status, newStatus: 'RUNNING' }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to resume agent' };
    }
  }
}

@Injectable()
export class ListTasksTool extends BaseStructuredTool {
  readonly name = 'listTasks';
  readonly description = 'List tasks. Use when user asks about tasks, their status, or wants to see pending work.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListTasksInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ListTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId };
      if (input.status) where.status = input.status;
      if (input.agentId) where.agentId = input.agentId;
      const tasks = await this.prisma.task.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true, priority: true, agentId: true, createdAt: true } });
      return { success: true, data: { tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, agentId: t.agentId, createdAt: t.createdAt.toISOString() })), total: tasks.length }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list tasks' };
    }
  }
}

@Injectable()
export class GetTenantSnapshotTool extends BaseStructuredTool {
  readonly name = 'getTenantSnapshot';
  readonly description = 'Get a live snapshot of the tenant: agents, tasks, departments, workflows, approvals, and costs.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTenantSnapshotInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenantId = context.tenantId;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [agentsByStatus, departmentsCount, tasksByStatus, workflowsByStatus, pendingApprovals, costMonth] = await Promise.all([
        this.prisma.agent.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.prisma.department.count({ where: { tenantId, status: 'ACTIVE' } }).catch(() => 0),
        this.prisma.task.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.prisma.workflow.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.prisma.approvalRequest.count({ where: { tenantId, status: 'PENDING' } }).catch(() => 0),
        this.prisma.costRecord.aggregate({ where: { tenantId, windowStart: { gte: monthStart } }, _sum: { costCents: true } }).catch(() => null),
      ]);
      const agentCounts: Record<string, number> = {}; let totalAgents = 0;
      for (const row of agentsByStatus) { const c = row._count?._all ?? 0; agentCounts[row.status] = c; totalAgents += c; }
      const taskCounts: Record<string, number> = {}; let totalTasks = 0;
      for (const row of tasksByStatus) { const c = row._count?._all ?? 0; taskCounts[row.status] = c; totalTasks += c; }
      const workflowCounts: Record<string, number> = {}; let totalWorkflows = 0;
      for (const row of workflowsByStatus) { const c = row._count?._all ?? 0; workflowCounts[row.status] = c; totalWorkflows += c; }
      return { success: true, data: { tenantId, generatedAt: now.toISOString(), agents: { total: totalAgents, byStatus: agentCounts }, departments: { active: departmentsCount }, tasks: { total: totalTasks, byStatus: taskCounts }, workflows: { total: totalWorkflows, byStatus: workflowCounts }, approvals: { pending: pendingApprovals }, cost: { monthToDateCents: costMonth?._sum?.costCents ? Number(costMonth._sum.costCents) : 0, currency: 'USD' } }, metadata: { model: 'neurecore-snapshot-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get tenant snapshot' };
    }
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// P1: DEPARTMENT TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class UpdateDepartmentTool extends BaseStructuredTool {
  readonly name = 'updateDepartment';
  readonly description = 'Update a department name or description.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateDepartmentInputSchema;
  readonly requiredPermissions = ['department:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: UpdateDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.prisma.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } });
      if (!dept) return { success: false, error: 'Department not found' };
      const updated = await this.prisma.department.update({ where: { id: input.departmentId }, data: { name: input.name ?? dept.name, description: input.description ?? dept.description } });
      return { success: true, data: { departmentId: updated.id, name: updated.name, description: updated.description }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update department' };
    }
  }
}

@Injectable()
export class ArchiveDepartmentTool extends BaseStructuredTool {
  readonly name = 'archiveDepartment';
  readonly description = 'Archive (soft-delete) a department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ArchiveDepartmentInputSchema;
  readonly requiredPermissions = ['department:archive'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ArchiveDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.prisma.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } });
      if (!dept) return { success: false, error: 'Department not found' };
      const updated = await this.prisma.department.update({ where: { id: input.departmentId }, data: { status: 'INACTIVE' } });
      return { success: true, data: { departmentId: updated.id, name: updated.name, previousStatus: dept.status, newStatus: updated.status }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to archive department' };
    }
  }
}

@Injectable()
export class DeleteDepartmentTool extends BaseStructuredTool {
  readonly name = 'deleteDepartment';
  readonly description = 'Permanently delete an empty department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = DeleteDepartmentInputSchema;
  readonly requiredPermissions = ['department:delete'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: DeleteDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.prisma.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId }, include: { _count: { select: { agents: true, members: true } } } });
      if (!dept) return { success: false, error: 'Department not found' };
      if (dept._count.agents > 0 || dept._count.members > 0) return { success: false, error: `Cannot delete department with ${dept._count.agents} agents and ${dept._count.members} members.` };
      await this.prisma.department.delete({ where: { id: input.departmentId } });
      return { success: true, data: { departmentId: input.departmentId, deleted: true }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete department' };
    }
  }
}

@Injectable()
export class AssignManagerTool extends BaseStructuredTool {
  readonly name = 'assignManager';
  readonly description = 'Assign an agent as the head/manager of a department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AssignManagerInputSchema;
  readonly requiredPermissions = ['department:assignManager'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: AssignManagerInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const [dept, agent] = await Promise.all([
        this.prisma.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } }),
        this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } }),
      ]);
      if (!dept) return { success: false, error: 'Department not found' };
      if (!agent) return { success: false, error: 'Agent not found' };
      const updated = await this.prisma.department.update({ where: { id: input.departmentId }, data: { headAgentId: input.agentId } });
      return { success: true, data: { departmentId: updated.id, departmentName: updated.name, managerAgentId: agent.id, managerAgentName: agent.name }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to assign manager' };
    }
  }
}

@Injectable()
export class UnassignManagerTool extends BaseStructuredTool {
  readonly name = 'unassignManager';
  readonly description = 'Remove the head/manager from a department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UnassignManagerInputSchema;
  readonly requiredPermissions = ['department:assignManager'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: UnassignManagerInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.prisma.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } });
      if (!dept) return { success: false, error: 'Department not found' };
      const updated = await this.prisma.department.update({ where: { id: input.departmentId }, data: { headAgentId: null } });
      return { success: true, data: { departmentId: updated.id, departmentName: updated.name, managerRemoved: true }, metadata: { model: 'neurecore-dept-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to unassign manager' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// P1: AGENT TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class GetAgentTool extends BaseStructuredTool {
  readonly name = 'getAgent';
  readonly description = 'Get detailed information about an agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetAgentInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: GetAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId }, include: { department: { select: { id: true, name: true } }, _count: { select: { tasks: true } } } });
      if (!agent) return { success: false, error: 'Agent not found' };
      return { success: true, data: { id: agent.id, name: agent.name, description: agent.description, type: agent.type, status: agent.status, model: agent.model, department: agent.department, taskCount: agent._count.tasks, createdAt: agent.createdAt.toISOString() }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get agent' };
    }
  }
}

@Injectable()
export class UpdateAgentTool extends BaseStructuredTool {
  readonly name = 'updateAgent';
  readonly description = 'Update an agent name, description, status, model, or system prompt.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateAgentInputSchema;
  readonly requiredPermissions = ['agent:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: UpdateAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.model !== undefined) updateData.model = input.model;
      if (input.systemPrompt !== undefined) updateData.systemPrompt = input.systemPrompt;
      const updated = await this.prisma.agent.update({ where: { id: input.agentId }, data: updateData });
      return { success: true, data: { agentId: updated.id, name: updated.name, status: updated.status, updatedFields: Object.keys(updateData) }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update agent' };
    }
  }
}

@Injectable()
export class ArchiveAgentTool extends BaseStructuredTool {
  readonly name = 'archiveAgent';
  readonly description = 'Archive an agent (soft-delete).';
  readonly category = ToolCategory.API;
  readonly inputSchema = ArchiveAgentInputSchema;
  readonly requiredPermissions = ['agent:archive'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ArchiveAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      const updated = await this.prisma.agent.update({ where: { id: input.agentId }, data: { status: 'ARCHIVED', isActive: false } });
      return { success: true, data: { agentId: updated.id, name: updated.name, previousStatus: agent.status, newStatus: 'ARCHIVED' }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to archive agent' };
    }
  }
}

@Injectable()
export class AssignAgentToDepartmentTool extends BaseStructuredTool {
  readonly name = 'assignAgentToDepartment';
  readonly description = 'Move an agent to a different department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AssignAgentToDepartmentInputSchema;
  readonly requiredPermissions = ['agent:assignDepartment'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: AssignAgentToDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const [agent, dept] = await Promise.all([
        this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } }),
        this.prisma.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } }),
      ]);
      if (!agent) return { success: false, error: 'Agent not found' };
      if (!dept) return { success: false, error: 'Department not found' };
      const updated = await this.prisma.agent.update({ where: { id: input.agentId }, data: { departmentId: input.departmentId } });
      return { success: true, data: { agentId: updated.id, agentName: updated.name, departmentId: dept.id, departmentName: dept.name }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to assign agent to department' };
    }
  }
}

@Injectable()
export class RemoveAgentFromProjectTool extends BaseStructuredTool {
  readonly name = 'removeAgentFromProject';
  readonly description = 'Remove an agent from a project (projects link agents via tasks, not directly).';
  readonly category = ToolCategory.API;
  readonly inputSchema = RemoveAgentFromProjectInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: RemoveAgentFromProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.prisma.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!project) return { success: false, error: 'Project not found' };
      return { success: true, data: { agentId: input.agentId, projectId: input.projectId, note: 'Projects are not directly linked to agents. Agents work on projects via tasks.' }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed' };
    }
  }
}

@Injectable()
export class BulkCreateAgentsTool extends BaseStructuredTool {
  readonly name = 'bulkCreateAgents';
  readonly description = 'Create multiple agents at once (up to 50).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkCreateAgentsInputSchema;
  readonly requiredPermissions = ['agent:create'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: BulkCreateAgentsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const results = await Promise.all(input.agents.map(a => this.prisma.agent.create({ data: { name: a.name, type: a.type, model: a.model ?? 'gpt-4o-mini', tenantId: context.tenantId as string, departmentId: a.departmentId ?? null, description: a.description ?? null, status: 'IDLE' } })));
      return { success: true, data: { created: results.map(a => ({ id: a.id, name: a.name, type: a.type, status: a.status })), total: results.length }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk create agents' };
    }
  }
}

@Injectable()
export class BulkAssignToDepartmentTool extends BaseStructuredTool {
  readonly name = 'bulkAssignToDepartment';
  readonly description = 'Move multiple agents to a department at once (up to 100).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkAssignToDepartmentInputSchema;
  readonly requiredPermissions = ['agent:assignDepartment'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: BulkAssignToDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const dept = await this.prisma.department.findFirst({ where: { id: input.departmentId, tenantId: context.tenantId } });
      if (!dept) return { success: false, error: 'Department not found' };
      await Promise.all(input.agentIds.map(id => this.prisma.agent.update({ where: { id }, data: { departmentId: input.departmentId } })));
      return { success: true, data: { departmentId: dept.id, departmentName: dept.name, movedAgentIds: input.agentIds, count: input.agentIds.length }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk assign agents' };
    }
  }
}

@Injectable()
export class GetAgentWorkloadTool extends BaseStructuredTool {
  readonly name = 'getAgentWorkload';
  readonly description = 'Get the current workload of an agent: number of assigned tasks by status.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetAgentWorkloadInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: GetAgentWorkloadInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      const tasksByStatus = await this.prisma.task.groupBy({ by: ['status'], where: { agentId: input.agentId, tenantId: context.tenantId }, _count: { _all: true } });
      const breakdown: Record<string, number> = {}; let total = 0;
      for (const row of tasksByStatus) { const c = row._count?._all ?? 0; breakdown[row.status] = c; total += c; }
      return { success: true, data: { agentId: agent.id, agentName: agent.name, status: agent.status, totalTasks: total, byStatus: breakdown }, metadata: { model: 'neurecore-agent-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get agent workload' };
    }
  }
}
// ═══════════════════════════════════════════════════════════════════════════
// P1: PROJECT TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class GetProjectTool extends BaseStructuredTool {
  readonly name = 'getProject';
  readonly description = 'Get detailed information about a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetProjectInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: GetProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.prisma.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      const goals = await this.prisma.goal.count({ where: { tenantId: context.tenantId } }).catch(() => 0);
      if (!project) return { success: false, error: 'Project not found' };
      return { success: true, data: { id: project.id, name: project.name, description: project.description, status: project.status, departmentId: project.departmentId, goalCount: goals, targetDate: project.targetDate?.toISOString() ?? null, createdAt: project.createdAt.toISOString() }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get project' };
    }
  }
}

@Injectable()
export class UpdateProjectTool extends BaseStructuredTool {
  readonly name = 'updateProject';
  readonly description = 'Update a project name, description, status, or target date.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateProjectInputSchema;
  readonly requiredPermissions = ['project:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: UpdateProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.prisma.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!project) return { success: false, error: 'Project not found' };
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.targetDate !== undefined) updateData.targetDate = new Date(input.targetDate);
      const updated = await this.prisma.project.update({ where: { id: input.projectId }, data: updateData });
      return { success: true, data: { projectId: updated.id, name: updated.name, status: updated.status, updatedFields: Object.keys(updateData) }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update project' };
    }
  }
}

@Injectable()
export class ArchiveProjectTool extends BaseStructuredTool {
  readonly name = 'archiveProject';
  readonly description = 'Archive a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ArchiveProjectInputSchema;
  readonly requiredPermissions = ['project:archive'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ArchiveProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.prisma.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!project) return { success: false, error: 'Project not found' };
      const updated = await this.prisma.project.update({ where: { id: input.projectId }, data: { status: 'ARCHIVED' } });
      return { success: true, data: { projectId: updated.id, name: updated.name, previousStatus: project.status, newStatus: 'ARCHIVED' }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to archive project' };
    }
  }
}

@Injectable()
export class DeleteProjectTool extends BaseStructuredTool {
  readonly name = 'deleteProject';
  readonly description = 'Permanently delete a project.';
  readonly category = ToolCategory.API;
  readonly inputSchema = DeleteProjectInputSchema;
  readonly requiredPermissions = ['project:delete'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: DeleteProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const project = await this.prisma.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!project) return { success: false, error: 'Project not found' };
      await this.prisma.project.delete({ where: { id: input.projectId } });
      return { success: true, data: { projectId: input.projectId, deleted: true }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete project' };
    }
  }
}

@Injectable()
export class CloneProjectTool extends BaseStructuredTool {
  readonly name = 'cloneProject';
  readonly description = 'Duplicate a project with a new name. Optionally includes tasks.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CloneProjectInputSchema;
  readonly requiredPermissions = ['project:create'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: CloneProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const original = await this.prisma.project.findFirst({ where: { id: input.projectId, tenantId: context.tenantId } });
      if (!original) return { success: false, error: 'Project not found' };
      const cloned = await this.prisma.project.create({ data: { name: input.newName, description: original.description, tenantId: context.tenantId as string, departmentId: original.departmentId, goalIds: [], status: 'ACTIVE', targetDate: original.targetDate } });
      return { success: true, data: { originalProjectId: input.projectId, newProjectId: cloned.id, newProjectName: cloned.name, tasksCloned: input.includeTasks }, metadata: { model: 'neurecore-project-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to clone project' };
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// P1: TASK TOOL IMPLEMENTATIONS
// ═══════════════════════════════════════════════════════════════════════════

@Injectable()
export class GetTaskTool extends BaseStructuredTool {
  readonly name = 'getTask';
  readonly description = 'Get detailed information about a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTaskInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: GetTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId }, include: { agent: { select: { id: true, name: true } }, createdBy: { select: { id: true, firstName: true, lastName: true } } } });
      if (!task) return { success: false, error: 'Task not found' };
      return { success: true, data: { id: task.id, title: task.title, description: task.description, status: task.status, priority: task.priority, agent: task.agent, createdBy: task.createdBy ? `${task.createdBy.firstName} ${task.createdBy.lastName}` : null, createdAt: task.createdAt.toISOString(), completedAt: task.completedAt?.toISOString() ?? null }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get task' };
    }
  }
}

@Injectable()
export class UpdateTaskTool extends BaseStructuredTool {
  readonly name = 'updateTask';
  readonly description = 'Update a task title, description, priority, or status.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateTaskInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: UpdateTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      const updateData: Record<string, unknown> = {};
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.status !== undefined) { updateData.status = input.status; if (input.status === 'COMPLETED') updateData.completedAt = new Date(); }
      const updated = await this.prisma.task.update({ where: { id: input.taskId }, data: updateData });
      return { success: true, data: { taskId: updated.id, title: updated.title, status: updated.status, priority: updated.priority, updatedFields: Object.keys(updateData) }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update task' };
    }
  }
}

@Injectable()
export class DeleteTaskTool extends BaseStructuredTool {
  readonly name = 'deleteTask';
  readonly description = 'Permanently delete a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = DeleteTaskInputSchema;
  readonly requiredPermissions = ['task:delete'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: DeleteTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      await this.prisma.task.delete({ where: { id: input.taskId } });
      return { success: true, data: { taskId: input.taskId, deleted: true }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete task' };
    }
  }
}

@Injectable()
export class AssignTaskTool extends BaseStructuredTool {
  readonly name = 'assignTask';
  readonly description = 'Assign a task to an agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AssignTaskInputSchema;
  readonly requiredPermissions = ['task:assign'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: AssignTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const [task, agent] = await Promise.all([this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } }), this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } })]);
      if (!task) return { success: false, error: 'Task not found' };
      if (!agent) return { success: false, error: 'Agent not found' };
      const updated = await this.prisma.task.update({ where: { id: input.taskId }, data: { agentId: input.agentId } });
      return { success: true, data: { taskId: updated.id, title: updated.title, assignedAgentId: agent.id, assignedAgentName: agent.name }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to assign task' };
    }
  }
}

@Injectable()
export class UnassignTaskTool extends BaseStructuredTool {
  readonly name = 'unassignTask';
  readonly description = 'Remove the assignee from a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UnassignTaskInputSchema;
  readonly requiredPermissions = ['task:assign'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: UnassignTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      const updated = await this.prisma.task.update({ where: { id: input.taskId }, data: { agentId: null } });
      return { success: true, data: { taskId: updated.id, title: updated.title, unassigned: true }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to unassign task' };
    }
  }
}

@Injectable()
export class MarkTaskCompleteTool extends BaseStructuredTool {
  readonly name = 'markTaskComplete';
  readonly description = 'Mark a task as completed.';
  readonly category = ToolCategory.API;
  readonly inputSchema = MarkTaskCompleteInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: MarkTaskCompleteInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      const updated = await this.prisma.task.update({ where: { id: input.taskId }, data: { status: 'COMPLETED', completedAt: new Date() } });
      return { success: true, data: { taskId: updated.id, title: updated.title, previousStatus: task.status, newStatus: 'COMPLETED', completedAt: updated.completedAt?.toISOString() }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to mark task complete' };
    }
  }
}

@Injectable()
export class MarkTaskInProgressTool extends BaseStructuredTool {
  readonly name = 'markTaskInProgress';
  readonly description = 'Move a task to in-progress status.';
  readonly category = ToolCategory.API;
  readonly inputSchema = MarkTaskInProgressInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: MarkTaskInProgressInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      const updated = await this.prisma.task.update({ where: { id: input.taskId }, data: { status: 'RUNNING', startedAt: task.startedAt ?? new Date() } });
      return { success: true, data: { taskId: updated.id, title: updated.title, previousStatus: task.status, newStatus: 'RUNNING' }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to mark task in progress' };
    }
  }
}

@Injectable()
export class ReopenTaskTool extends BaseStructuredTool {
  readonly name = 'reopenTask';
  readonly description = 'Reopen a completed, failed, or cancelled task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ReopenTaskInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ReopenTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      const updated = await this.prisma.task.update({ where: { id: input.taskId }, data: { status: 'PENDING', completedAt: null, error: null } });
      return { success: true, data: { taskId: updated.id, title: updated.title, previousStatus: task.status, newStatus: 'PENDING' }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reopen task' };
    }
  }
}

@Injectable()
export class ChangeTaskPriorityTool extends BaseStructuredTool {
  readonly name = 'changeTaskPriority';
  readonly description = 'Change the priority of a task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ChangeTaskPriorityInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ChangeTaskPriorityInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const task = await this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!task) return { success: false, error: 'Task not found' };
      const updated = await this.prisma.task.update({ where: { id: input.taskId }, data: { priority: input.priority } });
      return { success: true, data: { taskId: updated.id, title: updated.title, previousPriority: task.priority, newPriority: updated.priority }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to change task priority' };
    }
  }
}

@Injectable()
export class AddSubtaskTool extends BaseStructuredTool {
  readonly name = 'addSubtask';
  readonly description = 'Create a subtask under a parent task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = AddSubtaskInputSchema;
  readonly requiredPermissions = ['task:create'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: AddSubtaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const parent = await this.prisma.task.findFirst({ where: { id: input.parentTaskId, tenantId: context.tenantId } });
      if (!parent) return { success: false, error: 'Parent task not found' };
      const subtask = await this.prisma.task.create({ data: { title: input.title, tenantId: context.tenantId as string, agentId: input.agentId ?? null, createdById: (context.userId as string) ?? null, priority: input.priority ?? 'MEDIUM', status: 'PENDING', input: { parentTaskId: input.parentTaskId } } });
      return { success: true, data: { subtaskId: subtask.id, title: subtask.title, parentTaskId: input.parentTaskId, priority: subtask.priority, status: subtask.status }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add subtask' };
    }
  }
}

@Injectable()
export class ListSubtasksTool extends BaseStructuredTool {
  readonly name = 'listSubtasks';
  readonly description = 'List all subtasks of a parent task.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListSubtasksInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: ListSubtasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const subtasks = await this.prisma.task.findMany({ where: { tenantId: context.tenantId as string, input: { path: ['parentTaskId'], equals: input.parentTaskId } }, select: { id: true, title: true, status: true, priority: true, agentId: true, createdAt: true } });
      return { success: true, data: { parentTaskId: input.parentTaskId, subtasks: subtasks.map(s => ({ id: s.id, title: s.title, status: s.status, priority: s.priority, agentId: s.agentId, createdAt: s.createdAt.toISOString() })), total: subtasks.length }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list subtasks' };
    }
  }
}

@Injectable()
export class GetMyTasksTool extends BaseStructuredTool {
  readonly name = 'getMyTasks';
  readonly description = 'Get tasks assigned to the current user/agent context.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetMyTasksInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: GetMyTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.agentId) return { success: false, error: 'Agent context required for getMyTasks' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, agentId: context.agentId };
      if (input.status) where.status = input.status;
      if (input.priority) where.priority = input.priority;
      const tasks = await this.prisma.task.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true, priority: true, createdAt: true } });
      return { success: true, data: { tasks: tasks.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, createdAt: t.createdAt.toISOString() })), total: tasks.length }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get my tasks' };
    }
  }
}

@Injectable()
export class GetOverdueTasksTool extends BaseStructuredTool {
  readonly name = 'getOverdueTasks';
  readonly description = 'Get all overdue tasks (past due date, not completed).';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetOverdueTasksInputSchema;

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: GetOverdueTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, status: { not: 'COMPLETED' } };
      if (input.departmentId) where.departmentId = input.departmentId;
      const tasks = await this.prisma.task.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, include: { agent: { select: { id: true, name: true } } } });
      const overdue = tasks.filter(t => t.completedAt === null);
      return { success: true, data: { overdueTasks: overdue.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, agent: t.agent, createdAt: t.createdAt.toISOString() })), total: overdue.length }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get overdue tasks' };
    }
  }
}

@Injectable()
export class BulkAssignTasksTool extends BaseStructuredTool {
  readonly name = 'bulkAssignTasks';
  readonly description = 'Assign multiple tasks to the same agent at once (up to 100).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkAssignTasksInputSchema;
  readonly requiredPermissions = ['task:assign'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: BulkAssignTasksInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const agent = await this.prisma.agent.findFirst({ where: { id: input.agentId, tenantId: context.tenantId } });
      if (!agent) return { success: false, error: 'Agent not found' };
      await Promise.all(input.taskIds.map(id => this.prisma.task.update({ where: { id }, data: { agentId: input.agentId } })));
      return { success: true, data: { assignedAgentId: agent.id, assignedAgentName: agent.name, taskCount: input.taskIds.length, taskIds: input.taskIds }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk assign tasks' };
    }
  }
}

@Injectable()
export class BulkChangeStatusTool extends BaseStructuredTool {
  readonly name = 'bulkChangeStatus';
  readonly description = 'Change the status of multiple tasks at once (up to 100).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkChangeStatusInputSchema;
  readonly requiredPermissions = ['task:update'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: BulkChangeStatusInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const updateData: Record<string, unknown> = { status: input.status };
      if (input.status === 'COMPLETED') updateData.completedAt = new Date();
      await Promise.all(input.taskIds.map(id => this.prisma.task.update({ where: { id }, data: updateData })));
      return { success: true, data: { newStatus: input.status, taskCount: input.taskIds.length, taskIds: input.taskIds }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk change status' };
    }
  }
}

@Injectable()
export class CloneTaskTool extends BaseStructuredTool {
  readonly name = 'cloneTask';
  readonly description = 'Duplicate a task, optionally assigning it to a different agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CloneTaskInputSchema;
  readonly requiredPermissions = ['task:create'];

  constructor(private readonly prisma: PrismaService) { super(); }

  protected async executeImpl(input: CloneTaskInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const original = await this.prisma.task.findFirst({ where: { id: input.taskId, tenantId: context.tenantId } });
      if (!original) return { success: false, error: 'Task not found' };
      const cloned = await this.prisma.task.create({ data: { title: `${original.title} (copy)`, description: original.description, priority: original.priority, tenantId: context.tenantId as string, agentId: input.newAssigneeId ?? null, createdById: (context.userId as string) ?? null, status: 'PENDING', input: original.input as any } });
      return { success: true, data: { originalTaskId: input.taskId, newTaskId: cloned.id, newTaskTitle: cloned.title, newAssigneeId: cloned.agentId }, metadata: { model: 'neurecore-task-v1' } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to clone task' };
    }
  }
}
// P1: APPROVAL TOOL IMPLEMENTATIONS
@Injectable()
export class ListPendingApprovalsTool extends BaseStructuredTool {
  readonly name = 'listPendingApprovals';
  readonly description = 'List all pending approval requests for the tenant.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListPendingApprovalsInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: ListPendingApprovalsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, status: 'PENDING' };
      if (input.priority) where.priority = input.priority;
      const approvals = await this.prisma.approvalRequest.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, description: true, resourceType: true, priority: true, status: true, createdAt: true } });
      return { success: true, data: { approvals: approvals.map(a => ({ id: a.id, title: a.title, description: a.description, resourceType: a.resourceType, priority: a.priority, status: a.status, createdAt: a.createdAt.toISOString() })), total: approvals.length }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to list pending approvals' }; }
  }
}
@Injectable()
export class GetApprovalTool extends BaseStructuredTool {
  readonly name = 'getApproval';
  readonly description = 'Get detailed information about an approval request.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetApprovalInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetApprovalInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.prisma.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId }, include: { requestedBy: { select: { id: true, firstName: true, lastName: true } }, reviewedBy: { select: { id: true, firstName: true, lastName: true } } } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      return { success: true, data: { id: approval.id, title: approval.title, description: approval.description, resourceType: approval.resourceType, resourceId: approval.resourceId, priority: approval.priority, status: approval.status, requestedBy: approval.requestedBy ? `${approval.requestedBy.firstName} ${approval.requestedBy.lastName}` : null, reviewedBy: approval.reviewedBy ? `${approval.reviewedBy.firstName} ${approval.reviewedBy.lastName}` : null, approvedAt: approval.approvedAt?.toISOString() ?? null, rejectedAt: approval.rejectedAt?.toISOString() ?? null, rejectionReason: approval.rejectionReason, createdAt: approval.createdAt.toISOString() }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get approval' }; }
  }
}
@Injectable()
export class ApproveRequestTool extends BaseStructuredTool {
  readonly name = 'approveRequest';
  readonly description = 'Approve an approval request.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ApproveRequestInputSchema;
  readonly requiredPermissions = ['approval:approve'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: ApproveRequestInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.prisma.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (approval.status !== 'PENDING') return { success: false, error: `Cannot approve request with status: ${approval.status}` };
      const updated = await this.prisma.approvalRequest.update({ where: { id: input.approvalId }, data: { status: 'APPROVED', approvedAt: new Date(), reviewedById: context.userId } });
      return { success: true, data: { approvalId: updated.id, title: updated.title, newStatus: 'APPROVED', approvedAt: updated.approvedAt?.toISOString() }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to approve request' }; }
  }
}
@Injectable()
export class RejectRequestTool extends BaseStructuredTool {
  readonly name = 'rejectRequest';
  readonly description = 'Reject an approval request with a reason.';
  readonly category = ToolCategory.API;
  readonly inputSchema = RejectRequestInputSchema;
  readonly requiredPermissions = ['approval:reject'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: RejectRequestInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.prisma.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (approval.status !== 'PENDING') return { success: false, error: `Cannot reject request with status: ${approval.status}` };
      const updated = await this.prisma.approvalRequest.update({ where: { id: input.approvalId }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: input.reason, reviewedById: context.userId } });
      return { success: true, data: { approvalId: updated.id, title: updated.title, newStatus: 'REJECTED', rejectionReason: input.reason }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to reject request' }; }
  }
}
@Injectable()
export class BulkApproveTool extends BaseStructuredTool {
  readonly name = 'bulkApprove';
  readonly description = 'Approve multiple approval requests at once (up to 50).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkApproveInputSchema;
  readonly requiredPermissions = ['approval:approve'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: BulkApproveInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try { await Promise.all(input.approvalIds.map(id => this.prisma.approvalRequest.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), reviewedById: context.userId } }))); return { success: true, data: { approvedIds: input.approvalIds, count: input.approvalIds.length }, metadata: { model: 'neurecore-approval-v1' } }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk approve' }; }
  }
}
@Injectable()
export class BulkRejectTool extends BaseStructuredTool {
  readonly name = 'bulkReject';
  readonly description = 'Reject multiple approval requests with the same reason (up to 50).';
  readonly category = ToolCategory.API;
  readonly inputSchema = BulkRejectInputSchema;
  readonly requiredPermissions = ['approval:reject'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: BulkRejectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try { await Promise.all(input.approvalIds.map(id => this.prisma.approvalRequest.update({ where: { id }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: input.reason, reviewedById: context.userId } }))); return { success: true, data: { rejectedIds: input.approvalIds, count: input.approvalIds.length, reason: input.reason }, metadata: { model: 'neurecore-approval-v1' } }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to bulk reject' }; }
  }
}
@Injectable()
export class CreateApprovalRequestTool extends BaseStructuredTool {
  readonly name = 'createApprovalRequest';
  readonly description = 'Submit a new approval request.';
  readonly category = ToolCategory.API;
  readonly inputSchema = CreateApprovalRequestInputSchema;
  readonly requiredPermissions = ['approval:create'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: CreateApprovalRequestInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.prisma.approvalRequest.create({ data: { title: input.title, description: input.description, resourceType: input.resourceType, resourceId: input.resourceId ?? null, priority: input.priority ?? 'MEDIUM', tenantId: context.tenantId as string, requestedById: context.userId, status: 'PENDING' } });
      return { success: true, data: { approvalId: approval.id, title: approval.title, resourceType: approval.resourceType, status: approval.status, priority: approval.priority, createdAt: approval.createdAt.toISOString() }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to create approval request' }; }
  }
}
@Injectable()
export class GetMyPendingApprovalsTool extends BaseStructuredTool {
  readonly name = 'getMyPendingApprovals';
  readonly description = 'Get pending approval requests submitted by the current user.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetMyPendingApprovalsInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetMyPendingApprovalsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const approvals = await this.prisma.approvalRequest.findMany({ where: { tenantId: context.tenantId as string, status: 'PENDING', requestedById: context.userId }, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, resourceType: true, priority: true, status: true, createdAt: true } });
      return { success: true, data: { approvals: approvals.map(a => ({ id: a.id, title: a.title, resourceType: a.resourceType, priority: a.priority, status: a.status, createdAt: a.createdAt.toISOString() })), total: approvals.length }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get my pending approvals' }; }
  }
}
@Injectable()
export class ResubmitApprovalTool extends BaseStructuredTool {
  readonly name = 'resubmitApproval';
  readonly description = 'Resubmit a rejected approval request for review.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ResubmitApprovalInputSchema;
  readonly requiredPermissions = ['approval:create'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: ResubmitApprovalInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.prisma.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (approval.status !== 'REJECTED') return { success: false, error: `Can only resubmit rejected requests. Status: ${approval.status}` };
      const updated = await this.prisma.approvalRequest.update({ where: { id: input.approvalId }, data: { status: 'PENDING', rejectedAt: null, rejectionReason: null } });
      return { success: true, data: { approvalId: updated.id, title: updated.title, newStatus: 'PENDING' }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to resubmit approval' }; }
  }
}
@Injectable()
export class CancelApprovalRequestTool extends BaseStructuredTool {
  readonly name = 'cancelApprovalRequest';
  readonly description = 'Cancel a pending approval request (only by the requester).';
  readonly category = ToolCategory.API;
  readonly inputSchema = CancelApprovalRequestInputSchema;
  readonly requiredPermissions = ['approval:cancel'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: CancelApprovalRequestInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.prisma.approvalRequest.findFirst({ where: { id: input.approvalId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (approval.status !== 'PENDING') return { success: false, error: `Can only cancel pending requests. Status: ${approval.status}` };
      const updated = await this.prisma.approvalRequest.update({ where: { id: input.approvalId }, data: { status: 'CANCELLED' } });
      return { success: true, data: { approvalId: updated.id, title: updated.title, newStatus: 'CANCELLED' }, metadata: { model: 'neurecore-approval-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to cancel approval request' }; }
  }
}
// P1: BUDGET & COST TOOLS
@Injectable()
export class GetCostReportTool extends BaseStructuredTool {
  readonly name = 'getCostReport';
  readonly description = 'Get cost breakdown over a date range, grouped by day/week/month.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCostReportInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetCostReportInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const fromDate = input.fromDate ? new Date(input.fromDate) : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = input.toDate ? new Date(input.toDate) : new Date();
      const records = await this.prisma.costRecord.findMany({ where: { tenantId: context.tenantId as string, windowStart: { gte: fromDate }, windowEnd: { lte: toDate } }, orderBy: { windowStart: 'asc' } });
      return { success: true, data: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), groupBy: input.groupBy ?? 'day', totalRecords: records.length, records: records.map(r => ({ provider: r.provider, model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costCents: Number(r.costCents), windowStart: r.windowStart.toISOString() })) }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost report' }; }
  }
}
@Injectable()
export class GetCostByDepartmentTool extends BaseStructuredTool {
  readonly name = 'getCostByDepartment';
  readonly description = 'Get costs grouped by department.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCostByDepartmentInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetCostByDepartmentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const fromDate = input.fromDate ? new Date(input.fromDate) : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = input.toDate ? new Date(input.toDate) : new Date();
      const records = await this.prisma.costRecord.groupBy({ by: ['departmentId'], where: { tenantId: context.tenantId as string, windowStart: { gte: fromDate }, departmentId: { not: null } }, _sum: { costCents: true }, _count: { _all: true } });
      const deptIds = records.filter(r => r.departmentId).map(r => r.departmentId!);
      const depts = await this.prisma.department.findMany({ where: { id: { in: deptIds } }, select: { id: true, name: true } });
      const deptMap = new Map(depts.map(d => [d.id, d.name]));
      return { success: true, data: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), byDepartment: records.map(r => ({ departmentId: r.departmentId, departmentName: deptMap.get(r.departmentId!) ?? 'Unknown', totalCostCents: r._sum?.costCents ? Number(r._sum.costCents) : 0, recordCount: r._count?._all ?? 0 })) }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost by department' }; }
  }
}
@Injectable()
export class GetCostByAgentTool extends BaseStructuredTool {
  readonly name = 'getCostByAgent';
  readonly description = 'Get costs grouped by agent.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCostByAgentInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetCostByAgentInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const fromDate = input.fromDate ? new Date(input.fromDate) : new Date(new Date().setDate(new Date().getDate() - 30));
      const toDate = input.toDate ? new Date(input.toDate) : new Date();
      const records = await this.prisma.costRecord.groupBy({ by: ['agentId'], where: { tenantId: context.tenantId as string, windowStart: { gte: fromDate }, agentId: { not: null } }, _sum: { costCents: true }, _count: { _all: true } });
      const agentIds = records.filter(r => r.agentId).map(r => r.agentId!);
      const agents = await this.prisma.agent.findMany({ where: { id: { in: agentIds } }, select: { id: true, name: true } });
      const agentMap = new Map(agents.map(a => [a.id, a.name]));
      return { success: true, data: { fromDate: fromDate.toISOString(), toDate: toDate.toISOString(), byAgent: records.map(r => ({ agentId: r.agentId, agentName: agentMap.get(r.agentId!) ?? 'Unknown', totalCostCents: r._sum?.costCents ? Number(r._sum.costCents) : 0, recordCount: r._count?._all ?? 0 })) }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost by agent' }; }
  }
}
@Injectable()
export class GetCostByProjectTool extends BaseStructuredTool {
  readonly name = 'getCostByProject';
  readonly description = 'Get costs grouped by project. Note: Projects are linked via departments.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCostByProjectInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetCostByProjectInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const projects = await this.prisma.project.findMany({ where: { tenantId: context.tenantId }, select: { id: true, name: true, departmentId: true } });
      return { success: true, data: { projects: projects.map(p => ({ projectId: p.id, projectName: p.name, note: 'Cost records are attributed by department.' })) }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost by project' }; }
  }
}
@Injectable()
export class SetBudgetAlertTool extends BaseStructuredTool {
  readonly name = 'setBudgetAlert';
  readonly description = 'Configure a budget alert threshold.';
  readonly category = ToolCategory.API;
  readonly inputSchema = SetBudgetAlertInputSchema;
  readonly requiredPermissions = ['budget:configure'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: SetBudgetAlertInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const rule = await this.prisma.governanceRule.create({ data: { name: `Budget Alert ${input.thresholdPercent}%`, trigger: `cost.percentage >= ${input.thresholdPercent}`, actionType: 'ALERT', tenantId: input.departmentId ? null : context.tenantId, isActive: true, priority: 0 } });
      return { success: true, data: { alertId: rule.id, thresholdPercent: input.thresholdPercent, departmentId: input.departmentId ?? 'tenant-wide', isActive: true }, metadata: { model: 'neurecore-budget-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to set budget alert' }; }
  }
}
@Injectable()
export class GetTodayCostTool extends BaseStructuredTool {
  readonly name = 'getTodayCost';
  readonly description = 'Get total platform cost for today.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTodayCostInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
      const result = await this.prisma.costRecord.aggregate({ where: { tenantId: context.tenantId as string, windowStart: { gte: todayStart }, windowEnd: { lte: todayEnd } }, _sum: { costCents: true } });
      const totalCents = result._sum?.costCents ? Number(result._sum.costCents) : 0;
      return { success: true, data: { date: todayStart.toISOString().split('T')[0], totalCostCents: totalCents, totalCostUsd: (totalCents / 100).toFixed(4), currency: 'USD' }, metadata: { model: 'neurecore-cost-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get today cost' }; }
  }
}
// P1: COMPANY SETTINGS TOOLS
@Injectable()
export class GetCompanyProfileTool extends BaseStructuredTool {
  readonly name = 'getCompanyProfile';
  readonly description = 'Get the company/tenant profile.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetCompanyProfileInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenant = await this.prisma.tenant.findFirst({ where: { id: context.tenantId }, select: { id: true, name: true, logoUrl: true, website: true, industry: true, status: true, createdAt: true } });
      if (!tenant) return { success: false, error: 'Tenant not found' };
      return { success: true, data: { tenantId: tenant.id, name: tenant.name, logoUrl: tenant.logoUrl, website: tenant.website, industry: tenant.industry, status: tenant.status, createdAt: tenant.createdAt.toISOString() }, metadata: { model: 'neurecore-tenant-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get company profile' }; }
  }
}
@Injectable()
export class UpdateCompanyProfileTool extends BaseStructuredTool {
  readonly name = 'updateCompanyProfile';
  readonly description = 'Update the company/tenant profile.';
  readonly category = ToolCategory.API;
  readonly inputSchema = UpdateCompanyProfileInputSchema;
  readonly requiredPermissions = ['tenant:update'];
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: UpdateCompanyProfileInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const updateData: Record<string, unknown> = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.logoUrl !== undefined) updateData.logoUrl = input.logoUrl;
      if (input.website !== undefined) updateData.website = input.website;
      if (input.industry !== undefined) updateData.industry = input.industry;
      const updated = await this.prisma.tenant.update({ where: { id: context.tenantId }, data: updateData });
      return { success: true, data: { tenantId: updated.id, name: updated.name, logoUrl: updated.logoUrl, website: updated.website, industry: updated.industry, updatedFields: Object.keys(updateData) }, metadata: { model: 'neurecore-tenant-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to update company profile' }; }
  }
}
@Injectable()
export class GetTenantSettingsTool extends BaseStructuredTool {
  readonly name = 'getTenantSettings';
  readonly description = 'Get tenant settings and feature flags.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetTenantSettingsInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenant = await this.prisma.tenant.findFirst({ where: { id: context.tenantId }, select: { id: true, name: true, settings: true, metadata: true } });
      if (!tenant) return { success: false, error: 'Tenant not found' };
      return { success: true, data: { tenantId: tenant.id, name: tenant.name, settings: tenant.settings, metadata: tenant.metadata }, metadata: { model: 'neurecore-tenant-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get tenant settings' }; }
  }
}
// P1: NOTIFICATION TOOLS
@Injectable()
export class GetMyNotificationsTool extends BaseStructuredTool {
  readonly name = 'getMyNotifications';
  readonly description = 'Get notifications for the current user.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetMyNotificationsInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetMyNotificationsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, userId: context.userId };
      if (input.isRead !== undefined) where.isRead = input.isRead;
      const notifications = await this.prisma.notification.findMany({ where, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, type: true, title: true, message: true, isRead: true, createdAt: true } });
      return { success: true, data: { notifications: notifications.map(n => ({ id: n.id, type: n.type, title: n.title, message: n.message, isRead: n.isRead, createdAt: n.createdAt.toISOString() })), total: notifications.length, unreadCount: notifications.filter(n => !n.isRead).length }, metadata: { model: 'neurecore-notification-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get notifications' }; }
  }
}
@Injectable()
export class MarkNotificationReadTool extends BaseStructuredTool {
  readonly name = 'markNotificationRead';
  readonly description = 'Mark a single notification as read.';
  readonly category = ToolCategory.API;
  readonly inputSchema = MarkNotificationReadInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: MarkNotificationReadInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const notification = await this.prisma.notification.findFirst({ where: { id: input.notificationId, tenantId: context.tenantId } });
      if (!notification) return { success: false, error: 'Notification not found' };
      const updated = await this.prisma.notification.update({ where: { id: input.notificationId }, data: { isRead: true } });
      return { success: true, data: { notificationId: updated.id, isRead: true }, metadata: { model: 'neurecore-notification-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to mark notification read' }; }
  }
}
@Injectable()
export class MarkAllNotificationsReadTool extends BaseStructuredTool {
  readonly name = 'markAllNotificationsRead';
  readonly description = 'Mark all notifications for the current user as read.';
  readonly category = ToolCategory.API;
  readonly inputSchema = MarkAllNotificationsReadInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const result = await this.prisma.notification.updateMany({ where: { tenantId: context.tenantId as string, userId: context.userId, isRead: false }, data: { isRead: true } });
      return { success: true, data: { markedCount: result.count }, metadata: { model: 'neurecore-notification-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to mark all notifications read' }; }
  }
}
// P1: REPORTING TOOLS
@Injectable()
export class GetDashboardSummaryTool extends BaseStructuredTool {
  readonly name = 'getDashboardSummary';
  readonly description = 'Get a comprehensive dashboard summary.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetDashboardSummaryInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const tenantId = context.tenantId;
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const [agentStats, taskStats, deptCount, pendingApprovals, todayCost] = await Promise.all([
        this.prisma.agent.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.prisma.task.groupBy({ by: ['status'], where: { tenantId }, _count: { _all: true } }).catch(() => []),
        this.prisma.department.count({ where: { tenantId, status: 'ACTIVE' } }).catch(() => 0),
        this.prisma.approvalRequest.count({ where: { tenantId, status: 'PENDING' } }).catch(() => 0),
        this.prisma.costRecord.aggregate({ where: { tenantId, windowStart: { gte: new Date(now.setHours(0, 0, 0, 0)) } }, _sum: { costCents: true } }).catch(() => null),
      ]);
      const buildCounts = (rows: Array<{ status: string; _count: { _all: number } }>) => { const m: Record<string, number> = {}; let t = 0; for (const r of rows) { m[r.status] = r._count._all; t += r._count._all; } return { total: t, byStatus: m }; };
      return { success: true, data: { generatedAt: now.toISOString(), agents: buildCounts(agentStats), tasks: buildCounts(taskStats), departments: { active: deptCount }, approvals: { pending: pendingApprovals }, cost: { todayCents: todayCost?._sum?.costCents ? Number(todayCost._sum.costCents) : 0, currency: 'USD' } }, metadata: { model: 'neurecore-report-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get dashboard summary' }; }
  }
}
@Injectable()
export class GetOverdueTaskReportTool extends BaseStructuredTool {
  readonly name = 'getOverdueTaskReport';
  readonly description = 'Get all overdue tasks grouped by owner.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetOverdueTaskReportInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetOverdueTaskReportInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const where: Record<string, unknown> = { tenantId: context.tenantId as string, status: { not: 'COMPLETED' } };
      if (input.departmentId) where.departmentId = input.departmentId;
      const tasks = await this.prisma.task.findMany({ where, take: input.limit ?? 50, orderBy: { createdAt: 'desc' }, include: { agent: { select: { id: true, name: true } } } });
      const overdue = tasks.filter(t => t.completedAt === null);
      const byAgent: Record<string, { agentId: string; agentName: string; tasks: number }> = {};
      for (const t of overdue) { if (t.agent) { const key = t.agent.id; if (!byAgent[key]) byAgent[key] = { agentId: t.agent.id, agentName: t.agent.name, tasks: 0 }; byAgent[key].tasks++; } }
      return { success: true, data: { overdueTasks: overdue.map(t => ({ id: t.id, title: t.title, status: t.status, priority: t.priority, agent: t.agent })), totalOverdue: overdue.length, byAgent: Object.values(byAgent) }, metadata: { model: 'neurecore-report-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get overdue task report' }; }
  }
}
// P1: INBOX TOOLS
@Injectable()
export class GetInboxSummaryTool extends BaseStructuredTool {
  readonly name = 'getInboxSummary';
  readonly description = 'Get inbox summary counts by type for the current user.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetInboxSummaryInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(_input: unknown, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const [pendingApprovals, unreadNotifications] = await Promise.all([
        this.prisma.approvalRequest.count({ where: { tenantId: context.tenantId as string, requestedById: context.userId, status: 'PENDING' } }),
        this.prisma.notification.count({ where: { tenantId: context.tenantId as string, userId: context.userId, isRead: false } }),
      ]);
      return { success: true, data: { pendingApprovals, unreadNotifications, totalItems: pendingApprovals + unreadNotifications }, metadata: { model: 'neurecore-inbox-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get inbox summary' }; }
  }
}
@Injectable()
export class ListInboxItemsTool extends BaseStructuredTool {
  readonly name = 'listInboxItems';
  readonly description = 'List inbox items (approvals, notifications) for the current user.';
  readonly category = ToolCategory.API;
  readonly inputSchema = ListInboxItemsInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: ListInboxItemsInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    if (!context.userId) return { success: false, error: 'User context required' };
    try {
      const items: Array<{ id: string; type: string; title: string; status: string; createdAt: string }> = [];
      if (!input.type || input.type === 'approval') {
        const approvals = await this.prisma.approvalRequest.findMany({ where: { tenantId: context.tenantId as string, requestedById: context.userId, status: 'PENDING' }, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, status: true, createdAt: true } });
        items.push(...approvals.map(a => ({ id: a.id, type: 'approval', title: a.title, status: a.status, createdAt: a.createdAt.toISOString() })));
      }
      if (!input.type || input.type === 'notification') {
        const notifs = await this.prisma.notification.findMany({ where: { tenantId: context.tenantId as string, userId: context.userId }, take: input.limit ?? 20, orderBy: { createdAt: 'desc' }, select: { id: true, title: true, isRead: true, createdAt: true } });
        items.push(...notifs.map(n => ({ id: n.id, type: 'notification', title: n.title, status: n.isRead ? 'read' : 'unread', createdAt: n.createdAt.toISOString() })));
      }
      items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return { success: true, data: { items: items.slice(0, input.limit ?? 20), total: items.length }, metadata: { model: 'neurecore-inbox-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to list inbox items' }; }
  }
}
@Injectable()
export class GetInboxItemTool extends BaseStructuredTool {
  readonly name = 'getInboxItem';
  readonly description = 'Get detailed information about an inbox item.';
  readonly category = ToolCategory.API;
  readonly inputSchema = GetInboxItemInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: GetInboxItemInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const [approval, notification] = await Promise.all([
        this.prisma.approvalRequest.findFirst({ where: { id: input.itemId, tenantId: context.tenantId } }).catch(() => null),
        this.prisma.notification.findFirst({ where: { id: input.itemId, tenantId: context.tenantId } }).catch(() => null),
      ]);
      if (approval) return { success: true, data: { id: approval.id, type: 'approval', title: approval.title, description: approval.description, status: approval.status, priority: approval.priority, resourceType: approval.resourceType, createdAt: approval.createdAt.toISOString() }, metadata: { model: 'neurecore-inbox-v1' } };
      if (notification) return { success: true, data: { id: notification.id, type: notification.type, title: notification.title, message: notification.message, isRead: notification.isRead, createdAt: notification.createdAt.toISOString() }, metadata: { model: 'neurecore-inbox-v1' } };
      return { success: false, error: 'Inbox item not found' };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get inbox item' }; }
  }
}
@Injectable()
export class RespondToInboxItemTool extends BaseStructuredTool {
  readonly name = 'respondToInboxItem';
  readonly description = 'Approve, reject, or respond to an inbox item.';
  readonly category = ToolCategory.API;
  readonly inputSchema = RespondToInboxItemInputSchema;
  constructor(private readonly prisma: PrismaService) { super(); }
  protected async executeImpl(input: RespondToInboxItemInput, context?: Partial<ToolExecutionContext>): Promise<StructuredToolResult> {
    if (!context?.tenantId) return { success: false, error: 'Tenant context required' };
    try {
      const approval = await this.prisma.approvalRequest.findFirst({ where: { id: input.itemId, tenantId: context.tenantId } });
      if (!approval) return { success: false, error: 'Approval request not found' };
      if (input.action === 'approve') {
        await this.prisma.approvalRequest.update({ where: { id: input.itemId }, data: { status: 'APPROVED', approvedAt: new Date(), reviewedById: context.userId } });
        return { success: true, data: { itemId: input.itemId, action: 'approved' }, metadata: { model: 'neurecore-inbox-v1' } };
      } else if (input.action === 'reject') {
        await this.prisma.approvalRequest.update({ where: { id: input.itemId }, data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: input.comment ?? 'Rejected', reviewedById: context.userId } });
        return { success: true, data: { itemId: input.itemId, action: 'rejected' }, metadata: { model: 'neurecore-inbox-v1' } };
      }
      return { success: true, data: { itemId: input.itemId, action: input.action, note: 'Response recorded' }, metadata: { model: 'neurecore-inbox-v1' } };
    } catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to respond to inbox item' }; }
  }
}
