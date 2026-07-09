/**
 * execution-log module — Service
 *
 * Phase 4: Append-only task execution log.
 * No update/delete — ever.
 *
 * SOLID: Single Responsibility — only log entry creation and reading.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import type {
  IExecutionLogRepository,
  CreateLogEntryInput,
  ListLogEntriesOptions,
  TaskExecutionLogEntry,
} from './interfaces/execution-log.interface';

export const EXECUTION_LOG_REPOSITORY = 'EXECUTION_LOG_REPOSITORY';
export const EXECUTION_LOG_SERVICE = 'EXECUTION_LOG_SERVICE';

@Injectable()
export class ExecutionLogService {
  private readonly logger = new Logger(ExecutionLogService.name);

  constructor(
    @Inject(EXECUTION_LOG_REPOSITORY)
    private readonly repo: IExecutionLogRepository,
  ) {}

  async log(input: CreateLogEntryInput): Promise<TaskExecutionLogEntry> {
    const entry = await this.repo.create(input);
    this.logger.debug(
      `Logged ${input.action} for task ${input.taskId} by ${input.actorType}`,
    );
    return entry;
  }

  async getByTaskId(taskId: string, limit?: number): Promise<TaskExecutionLogEntry[]> {
    return this.repo.findByTaskId(taskId, limit);
  }

  async getByAgentId(agentId: string, limit?: number): Promise<TaskExecutionLogEntry[]> {
    return this.repo.findByAgentId(agentId, limit);
  }

  async findAll(
    tenantId: string,
    options?: ListLogEntriesOptions,
  ): Promise<{ data: TaskExecutionLogEntry[]; total: number }> {
    return this.repo.findAll(options ?? {}, tenantId);
  }

  /**
   * Log an approval action on a task.
   * Convenience method wrapping log().
   */
  async logApprovalAction(
    taskId: string,
    action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REQUEST_INFO' | 'COMPLETE',
    actorType: string,
    actorId: string,
    notes?: string,
    metadata?: Record<string, unknown>,
  ): Promise<TaskExecutionLogEntry> {
    return this.log({
      taskId,
      action,
      actorType,
      actorId,
      notes: notes ?? null,
      metadata: metadata ?? {},
    });
  }
}
