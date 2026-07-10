/**
 * Goals Module - Business Logic Service
 *
 * Phase 3: Goals + Tasks → Deliverables
 * SOLID: Single responsibility — handles all goal business logic.
 * Dependency Inversion: Uses IGoalRepository interface.
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import type { IGoalRepository } from './interfaces/goal.interface';
import type { Goal, GoalWithChildren } from './interfaces/goal.interface';
import type {
  CreateGoalInput,
  UpdateGoalInput,
  ListGoalsOptions,
} from './interfaces/goal.interface';

export const GOAL_REPOSITORY = 'GOAL_REPOSITORY';

@Injectable()
export class GoalsService {
  private readonly logger = new Logger(GoalsService.name);

  constructor(
    @Inject(GOAL_REPOSITORY) private readonly repository: IGoalRepository,
    private readonly prisma: PrismaService,
    @Optional() private readonly eventBus?: any,
  ) {}

  async create(input: CreateGoalInput, tenantId: string) {
    if (input.parentId) {
      const parent = await this.repository.findById(input.parentId, tenantId);
      if (!parent) {
        throw new NotFoundException(`Parent goal ${input.parentId} not found`);
      }
    }

    return this.repository.create(input, tenantId);
  }

  async findById(id: string, tenantId: string) {
    const goal = await this.repository.findById(id, tenantId);
    if (!goal) {
      throw new NotFoundException(`Goal ${id} not found`);
    }
    return goal;
  }

  async findAll(tenantId: string, options?: ListGoalsOptions) {
    return this.repository.findAll(options ?? {}, tenantId);
  }

  async findRootGoals(tenantId: string) {
    return this.repository.findRootGoals(tenantId);
  }

  async findByParentId(parentId: string, tenantId: string) {
    const parent = await this.repository.findById(parentId, tenantId);
    if (!parent) {
      throw new NotFoundException(`Goal ${parentId} not found`);
    }
    return this.repository.findByParentId(parentId, tenantId);
  }

  async findByProjectId(projectId: string, tenantId: string) {
    return this.repository.findByProjectId(projectId, tenantId);
  }

  async update(id: string, tenantId: string, input: UpdateGoalInput) {
    const existing = await this.repository.findById(id, tenantId);
    if (!existing) {
      throw new NotFoundException(`Goal ${id} not found`);
    }

    if (input.parentId !== undefined && input.parentId !== null) {
      if (input.parentId === id) {
        throw new BadRequestException('Goal cannot be its own parent');
      }
      const parent = await this.repository.findById(input.parentId, tenantId);
      if (!parent) {
        throw new NotFoundException(`Parent goal ${input.parentId} not found`);
      }
    }

    return this.repository.update(id, input);
  }

  async delete(id: string, tenantId: string) {
    const goal = await this.repository.findById(id, tenantId);
    if (!goal) {
      throw new NotFoundException(`Goal ${id} not found`);
    }

    const children = await this.repository.findByParentId(id, tenantId);
    if (children.length > 0) {
      throw new BadRequestException(
        `Cannot delete goal with ${children.length} child goals. Delete or reassign children first.`,
      );
    }

    await this.repository.delete(id, tenantId);
  }

  async updateProgress(id: string, tenantId: string, progress: number) {
    const goal = await this.repository.findById(id, tenantId);
    if (!goal) {
      throw new NotFoundException(`Goal ${id} not found`);
    }

    if (progress < 0 || progress > 100) {
      throw new BadRequestException('Progress must be between 0 and 100');
    }

    return this.repository.updateProgress(id, progress);
  }

  /**
   * Recalculate goal progress from linked task completion.
   * Phase 3: derived progress = completed tasks / total tasks × 100.
   *
   * If the goal has children (sub-goals), progress is the weighted average
   * of child goal progress plus task-based progress for this goal.
   */
  async recalculateProgressFromTasks(id: string, tenantId: string): Promise<Goal> {
    const goal = await this.repository.findById(id, tenantId);
    if (!goal) {
      throw new NotFoundException(`Goal ${id} not found`);
    }

    const tasks = await this.prisma.task.findMany({
      where: { goalId: id, tenantId },
      select: { id: true, status: true },
    });

    let taskBasedProgress = goal.progress;

    if (tasks.length > 0) {
      const completedCount = tasks.filter(
        (t) => t.status === 'COMPLETED',
      ).length;
      taskBasedProgress = Math.round((completedCount / tasks.length) * 100);
    }

    const children = await this.repository.findByParentId(id, tenantId);

    let finalProgress = taskBasedProgress;

    if (children.length > 0) {
      let totalChildProgress = 0;
      let childWeight = 0;

      for (const child of children) {
        const childProgress = await this.deriveProgressForGoal(child.id, tenantId);
        totalChildProgress += childProgress;
        childWeight += 1;
      }

      if (childWeight > 0) {
        finalProgress = Math.round(
          (taskBasedProgress + totalChildProgress) / (childWeight + 1),
        );
      }
    }

    finalProgress = Math.min(100, Math.max(0, finalProgress));

    const updated = await this.repository.updateProgress(id, finalProgress);
    this.logger.debug(
      `Goal ${id} progress recalculated: ${updated.progress}% (${tasks.length} tasks)`,
    );

    if (finalProgress >= 100 && this.eventBus) {
      try {
        this.eventBus.publish({
          type: 'GoalAchieved',
          projectId: goal.projectId,
          tenantId,
          timestamp: new Date(),
          payload: { goalId: goal.id, title: goal.title },
        });
      } catch (err) {
        this.logger.warn(`Failed to publish GoalAchieved event: ${err}`);
      }
    }

    return updated;
  }

  /**
   * Derive progress for a goal considering both its tasks and child goals.
   * Does NOT persist — just computes.
   */
  async deriveProgressForGoal(id: string, tenantId: string): Promise<number> {
    const goal = await this.repository.findById(id, tenantId);
    if (!goal) return 0;

    const tasks = await this.prisma.task.findMany({
      where: { goalId: id, tenantId },
      select: { status: true },
    });

    let taskProgress = goal.progress;
    if (tasks.length > 0) {
      const completedCount = tasks.filter(
        (t) => t.status === 'COMPLETED',
      ).length;
      taskProgress = Math.round((completedCount / tasks.length) * 100);
    }

    const children = await this.repository.findByParentId(id, tenantId);
    if (children.length === 0) return taskProgress;

    let totalChildProgress = 0;
    for (const child of children) {
      totalChildProgress += await this.deriveProgressForGoal(child.id, tenantId);
    }

    return Math.round(
      (taskProgress + totalChildProgress) / (children.length + 1),
    );
  }

  async getGoalTree(tenantId: string): Promise<GoalWithChildren[]> {
    const allGoals = await this.repository.findAll({ limit: 1000 }, tenantId);

    const goalMap = new Map<string, Goal & { children: Goal[] }>();
    const rootGoals: (Goal & { children: Goal[] })[] = [];

    for (const goal of allGoals.data) {
      goalMap.set(goal.id, { ...goal, children: [] });
    }

    for (const goal of allGoals.data) {
      const node = goalMap.get(goal.id)!;
      if (goal.parentId) {
        const parent = goalMap.get(goal.parentId);
        if (parent) {
          parent.children.push(node);
        } else {
          rootGoals.push(node);
        }
      } else {
        rootGoals.push(node);
      }
    }

    return rootGoals;
  }

  async calculateProgressWithChildren(id: string, tenantId: string): Promise<number> {
    return this.deriveProgressForGoal(id, tenantId);
  }
}
