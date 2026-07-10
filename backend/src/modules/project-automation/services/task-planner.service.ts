import { Injectable, Logger } from '@nestjs/common';
import { AgentPlannerService } from '../../agents/services/agent-planner.service';
import { TasksService } from '../../orchestration/services/tasks.service';
import type { Goal } from '../../goals/interfaces/goal.interface';
import type { Agent } from '@prisma/client';
import type { PlanningContext } from '../../agents/interfaces/agent-planner.interface';

export interface DecomposeResult {
  goalId: string;
  tasksCreated: number;
  errors: string[];
}

export interface DecomposeAllResult {
  totalGoals: number;
  totalTasks: number;
  results: DecomposeResult[];
}

@Injectable()
export class TaskPlannerService {
  private readonly logger = new Logger(TaskPlannerService.name);

  constructor(
    private readonly agentPlannerService: AgentPlannerService,
    private readonly tasksService: TasksService,
  ) {}

  async decomposeGoalIntoTasks(
    goal: Goal,
    spawnedAgents: Agent[],
    tenantId: string,
    actorId: string,
  ): Promise<DecomposeResult> {
    const result: DecomposeResult = { goalId: goal.id, tasksCreated: 0, errors: [] };

    const defaultAgent = spawnedAgents[0] ?? null;

    try {
      let plan;
      if (defaultAgent) {
        const context: PlanningContext = {
          agentId: defaultAgent.id,
          goal: `${goal.title}${goal.description ? ` — ${goal.description}` : ''}`,
          availableTools: [],
          constraints: [
            'Tasks should be atomic (one action per task)',
            'Maximum 5 tasks per goal',
          ],
        };
        plan = await this.agentPlannerService.plan(context);
      } else {
        plan = { goal: goal.title, steps: [{ id: 'step-1', description: goal.description ?? goal.title }] };
      }

      for (const step of plan.steps.slice(0, 5)) {
        const task = await this.tasksService.create(
          {
            title: step.description,
            description: step.description,
            goalId: goal.id,
            agentId: defaultAgent?.id,
            createdById: actorId,
            priority: 'MEDIUM',
          },
          tenantId,
        );
        result.tasksCreated++;
        this.logger.debug(`Created task "${task.title}" (${task.id}) for goal ${goal.id}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Failed to decompose goal ${goal.id}: ${msg}`);
      result.errors.push(msg);
      try {
        const fallback = await this.tasksService.create(
          {
            title: goal.title,
            description: goal.description ?? undefined,
            goalId: goal.id,
            agentId: defaultAgent?.id,
            createdById: actorId,
            priority: 'MEDIUM',
          },
          tenantId,
        );
        result.tasksCreated = 1;
        this.logger.debug(`Created fallback task "${fallback.title}" for goal ${goal.id}`);
      } catch (fallbackErr) {
        const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
        result.errors.push(`Fallback also failed: ${fallbackMsg}`);
      }
    }

    return result;
  }

  async decomposeAll(
    goals: Goal[],
    spawnedAgents: Agent[],
    tenantId: string,
    actorId: string,
  ): Promise<DecomposeAllResult> {
    const results: DecomposeResult[] = [];
    let totalTasks = 0;

    for (const goal of goals) {
      const result = await this.decomposeGoalIntoTasks(goal, spawnedAgents, tenantId, actorId);
      results.push(result);
      totalTasks += result.tasksCreated;
    }

    return { totalGoals: goals.length, totalTasks, results };
  }
}
