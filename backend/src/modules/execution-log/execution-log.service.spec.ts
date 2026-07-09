/**
 * execution-log.service.spec.ts — Phase 4 unit tests
 *
 * Covers:
 *  - log delegates to repo and debug-logs the action
 *  - getByTaskId/getByAgentId forward limit
 *  - logApprovalAction builds the right shape
 *  - findAll defaults to empty options
 *
 * Anti-pattern enforcement: the service exposes NO update/delete methods —
 * the append-only invariant is verified at the API surface level.
 */

import { ExecutionLogService } from './execution-log.service';
import type { IExecutionLogRepository } from './interfaces/execution-log.interface';
import type { TaskExecutionLogEntry } from './interfaces/execution-log.interface';

function makeService() {
  const repo: jest.Mocked<IExecutionLogRepository> = {
    create: jest.fn(),
    findByTaskId: jest.fn(),
    findByAgentId: jest.fn(),
    findAll: jest.fn(),
  } as unknown as jest.Mocked<IExecutionLogRepository>;
  const service = new ExecutionLogService(repo);
  return { service, repo };
}

const sampleEntry: TaskExecutionLogEntry = {
  id: 'log_1',
  taskId: 'task_1',
  action: 'draft_generated',
  agentId: null,
  actorId: 'agent_1',
  actorType: 'AI',
  previousStepId: null,
  nextStepId: null,
  notes: null,
  metadata: {},
  createdAt: new Date(),
};

describe('ExecutionLogService', () => {
  it('log delegates to repo', async () => {
    const { service, repo } = makeService();
    repo.create.mockResolvedValue(sampleEntry);
    const result = await service.log({
      taskId: 'task_1',
      action: 'draft_generated',
      actorId: 'agent_1',
      actorType: 'AI',
    });
    expect(result).toEqual(sampleEntry);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task_1',
      action: 'draft_generated',
    }));
  });

  it('getByTaskId forwards limit to repo', async () => {
    const { service, repo } = makeService();
    repo.findByTaskId.mockResolvedValue([sampleEntry]);
    const result = await service.getByTaskId('task_1', 25);
    expect(result).toEqual([sampleEntry]);
    expect(repo.findByTaskId).toHaveBeenCalledWith('task_1', 25);
  });

  it('getByAgentId forwards limit', async () => {
    const { service, repo } = makeService();
    repo.findByAgentId.mockResolvedValue([sampleEntry]);
    const result = await service.getByAgentId('agent_1', 10);
    expect(repo.findByAgentId).toHaveBeenCalledWith('agent_1', 10);
    expect(result).toHaveLength(1);
  });

  it('findAll defaults to empty options', async () => {
    const { service, repo } = makeService();
    repo.findAll.mockResolvedValue({ data: [sampleEntry], total: 1 });
    const result = await service.findAll('tenant_1');
    expect(repo.findAll).toHaveBeenCalledWith({}, 'tenant_1');
    expect(result.total).toBe(1);
  });

  it('logApprovalAction builds the correct payload', async () => {
    const { service, repo } = makeService();
    repo.create.mockResolvedValue(sampleEntry);
    await service.logApprovalAction('task_1', 'REJECT', 'HUMAN', 'user_1', 'Needs more context', {
      round: 2,
    });
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({
      taskId: 'task_1',
      action: 'REJECT',
      actorType: 'HUMAN',
      actorId: 'user_1',
      notes: 'Needs more context',
      metadata: { round: 2 },
    }));
  });

  it('append-only invariant: service has no update/delete method', () => {
    const { service } = makeService();
    const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(service));
    expect(methods).not.toContain('update');
    expect(methods).not.toContain('delete');
    expect(methods).not.toContain('remove');
  });
});
