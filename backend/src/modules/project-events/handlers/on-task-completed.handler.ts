import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ProjectEventBus } from '../project-event-bus.service';
import { GoalsService } from '../../goals/goals.service';
import type { DomainEvent } from '../interfaces/event.types';

@Injectable()
export class OnTaskCompletedHandler {
  private readonly logger = new Logger(OnTaskCompletedHandler.name);
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly eventBus: ProjectEventBus,
    @Optional() private readonly goalsService?: GoalsService,
  ) {}

  onModuleInit(): void {
    if (!this.goalsService) return;
    this.unsubscribe = this.eventBus.subscribe(
      'TaskCompleted',
      async (event: DomainEvent<{ taskId: string; goalId?: string; tenantId: string }>) => {
        await this.handle(event);
      },
    );
    this.logger.log('TaskCompleted handler registered');
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(
    event: DomainEvent<{ taskId: string; goalId?: string; tenantId: string }>,
  ): Promise<void> {
    const { taskId, goalId, tenantId } = event.payload;
    if (!goalId) return;

    try {
      await this.goalsService!.recalculateProgressFromTasks(goalId, tenantId);
      this.logger.debug(`Task ${taskId} completed — goal ${goalId} progress recalculated`);
    } catch (err) {
      this.logger.error(`Failed to recalculate goal ${goalId} progress: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
