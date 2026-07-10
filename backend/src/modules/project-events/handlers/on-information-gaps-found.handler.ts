import { Injectable, Logger, Inject, Optional } from '@nestjs/common';
import { ProjectEventBus } from '../project-event-bus.service';
import { ProjectMemoryService } from '../../project-memory/project-memory.service';
import type { DomainEvent } from '../interfaces/event.types';

@Injectable()
export class OnInformationGapsFoundHandler {
  private readonly logger = new Logger(OnInformationGapsFoundHandler.name);
  private unsubscribe: (() => void) | null = null;

  constructor(
    private readonly eventBus: ProjectEventBus,
    @Optional() private readonly memoryService?: ProjectMemoryService,
  ) {}

  onModuleInit(): void {
    if (!this.memoryService) return;
    this.unsubscribe = this.eventBus.subscribe(
      'InformationGapsFound',
      async (event: DomainEvent<{ projectId: string; tenantId: string; completenessScore: number; missingCount: number }>) => {
        await this.handle(event);
      },
    );
    this.logger.log('InformationGapsFound handler registered');
  }

  onModuleDestroy(): void {
    this.unsubscribe?.();
  }

  private async handle(
    event: DomainEvent<{ projectId: string; tenantId: string; completenessScore: number; missingCount: number }>,
  ): Promise<void> {
    const { projectId, tenantId, completenessScore, missingCount } = event.payload;
    try {
      await this.memoryService!.create(tenantId, {
        projectId,
        category: 'CONSTRAINT',
        content: `Information gaps detected: ${missingCount} questions unresolved (${completenessScore}% complete). Hermes discovery recommended.`,
        authorType: 'SYSTEM',
        isAiGenerated: true,
        isPinned: false,
      });
      this.logger.debug(`Information gaps found for project ${projectId} — CONSTRAINT memory entry written`);
    } catch (err) {
      this.logger.error(`InformationGapsFound handler failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
