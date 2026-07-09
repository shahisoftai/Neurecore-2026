/**
 * execution-log module — Interface Definitions
 *
 * Phase 4: Append-only task execution log entries
 * SOLID: Interface Segregation — focused on log entry persistence
 */

export type TaskExecutionLogEntry = {
  id: string;
  taskId: string;
  agentId: string | null;
  action: string;
  actorType: string;
  actorId: string | null;
  previousStepId: string | null;
  nextStepId: string | null;
  notes: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
};

export interface CreateLogEntryInput {
  taskId: string;
  agentId?: string | null;
  action: string;
  actorType?: string;
  actorId?: string | null;
  previousStepId?: string | null;
  nextStepId?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ListLogEntriesOptions {
  taskId?: string;
  agentId?: string;
  action?: string;
  page?: number;
  limit?: number;
}

export interface IExecutionLogRepository {
  create(data: CreateLogEntryInput): Promise<TaskExecutionLogEntry>;
  findByTaskId(taskId: string, limit?: number): Promise<TaskExecutionLogEntry[]>;
  findByAgentId(agentId: string, limit?: number): Promise<TaskExecutionLogEntry[]>;
  findAll(options: ListLogEntriesOptions, tenantId: string): Promise<{ data: TaskExecutionLogEntry[]; total: number }>;
}

export const EXECUTION_LOG_REPOSITORY = 'EXECUTION_LOG_REPOSITORY';
