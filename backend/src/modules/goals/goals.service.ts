/**
 * Goals Module - Business Logic Service
 *
 * Following SOLID principles:
 * - Single Responsibility: Only handles goal business logic
 * - Dependency Inversion: Uses IGoalRepository interface
 */

import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
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
    const goal = await this.repository.findById(id, tenantId);
    if (!goal) {
      throw new NotFoundException(`Goal ${id} not found`);
    }

    const children = await this.repository.findByParentId(id, tenantId);

    if (children.length === 0) {
      return goal.progress;
    }

    let totalProgress = goal.progress;
    let weight = 1;

    for (const child of children) {
      const childProgress = await this.calculateProgressWithChildren(child.id, tenantId);
      totalProgress += childProgress;
      weight += 1;
    }

    return Math.round(totalProgress / weight);
  }
}
