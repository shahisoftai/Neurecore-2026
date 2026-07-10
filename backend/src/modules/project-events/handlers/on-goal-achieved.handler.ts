import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ProjectEventBus } from '../project-event-bus.service';
import { ProjectMemoryService } from '../../project-memory/project-memory.service';
import type { DomainEvent } from '../interfaces/event.types';

@Injectable()
export class OnGoalAchievedHandler {
  private readonly logger = new Logger(OnGoalAchievedHandler.name);
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly eventBus: ProjectEventBus,
    @Optional() private readonly memoryService?: ProjectMemoryService,
  ) {}

  onModuleInit(): void {
    if (!this.memoryService) return;
    this.unsubscribe = this.eventBus.subscribe(
      'GoalAchieved',
      async (event: DomainEvent<{ goalId: string; title: string; projectId: string; tenantId: string }>) => {
        await this.handle(event);
      },
    );
    this.logger.log('GoalAchieved handler registered');
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(
    event: DomainEvent<{ goalId: string; title: string; projectId: string; tenantId: string }>,
  ): Promise<void> {
    const { goalId, title, projectId, tenantId } = event.payload;
    try {
      await this.memoryService!.create(tenantId, {
        projectId,
        category: 'INSIGHT',
        content: `Goal "${title}" (${goalId}) has been achieved.`,
        authorType: 'SYSTEM',
        isAiGenerated: true,
        isPinned: false,
      });
      this.logger.debug(`Goal ${goalId} achieved — memory entry written`);
    } catch (err) {
      this.logger.error(`Failed to write goal achievement memory: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
