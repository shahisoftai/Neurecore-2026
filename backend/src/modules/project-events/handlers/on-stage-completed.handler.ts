import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ProjectEventBus } from '../project-event-bus.service';
import { CompletenessService } from '../../information-engine/completeness/completeness.service';
import { ProjectMemoryService } from '../../project-memory/project-memory.service';
import type { DomainEvent } from '../interfaces/event.types';

@Injectable()
export class OnStageCompletedHandler {
  private readonly logger = new Logger(OnStageCompletedHandler.name);
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly eventBus: ProjectEventBus,
    @Optional() private readonly completenessService?: CompletenessService,
    @Optional() private readonly memoryService?: ProjectMemoryService,
  ) {}

  onModuleInit(): void {
    if (!this.completenessService || !this.memoryService) return;
    this.unsubscribe = this.eventBus.subscribe(
      'StageCompleted',
      async (event: DomainEvent<{ stageId: string; stageName: string; projectId: string; tenantId: string }>) => {
        await this.handle(event);
      },
    );
    this.logger.log('StageCompleted handler registered');
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(
    event: DomainEvent<{ stageId: string; stageName: string; projectId: string; tenantId: string }>,
  ): Promise<void> {
    const { stageName, projectId, tenantId } = event.payload;
    try {
      await this.completenessService!.recompute('PROJECT', projectId);
      await this.memoryService!.create(tenantId, {
        projectId,
        category: 'NOTE',
        content: `Stage "${stageName}" has been completed. Completeness has been recomputed.`,
        authorType: 'SYSTEM',
        isAiGenerated: true,
        isPinned: false,
      });
      this.logger.debug(`Stage "${stageName}" completed — completeness recomputed`);
    } catch (err) {
      this.logger.error(`Stage completion handler failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
