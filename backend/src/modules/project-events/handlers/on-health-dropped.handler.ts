import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ProjectEventBus } from '../project-event-bus.service';
import { ProjectMemoryService } from '../../project-memory/project-memory.service';
import type { DomainEvent } from '../interfaces/event.types';

@Injectable()
export class OnHealthDroppedHandler {
  private readonly logger = new Logger(OnHealthDroppedHandler.name);
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly eventBus: ProjectEventBus,
    @Optional() private readonly memoryService?: ProjectMemoryService,
  ) {}

  onModuleInit(): void {
    if (!this.memoryService) return;
    this.unsubscribe = this.eventBus.subscribe(
      'HealthScoreDropped',
      async (event: DomainEvent<{ projectId: string; tenantId: string; score: number; previousScore: number; reason?: string }>) => {
        await this.handle(event);
      },
    );
    this.logger.log('HealthScoreDropped handler registered');
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(
    event: DomainEvent<{ projectId: string; tenantId: string; score: number; previousScore: number; reason?: string }>,
  ): Promise<void> {
    const { projectId, tenantId, score, previousScore, reason } = event.payload;
    try {
      await this.memoryService!.create(tenantId, {
        projectId,
        category: 'RISK',
        content: `Health score dropped from ${previousScore} to ${score}${reason ? `: ${reason}` : ''}.`,
        authorType: 'SYSTEM',
        isAiGenerated: true,
        isPinned: true,
      });
      this.logger.debug(`Health dropped to ${score} — RISK memory entry written`);
    } catch (err) {
      this.logger.error(`HealthDropped handler failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
