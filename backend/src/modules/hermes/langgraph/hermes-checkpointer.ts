import { Injectable, Logger } from '@nestjs/common';
import { AgentCheckpointService } from '../../agents/langgraph/checkpoint.service';
import { HermesMemoryService } from '../services/hermes-memory.service';

@Injectable()
export class HermesCheckpointer {
  private readonly logger = new Logger(HermesCheckpointer.name);

  constructor(
    private readonly checkpointService: AgentCheckpointService,
    private readonly memoryService: HermesMemoryService,
  ) {}

  async save(threadId: string, state: Record<string, unknown>): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      await this.checkpointService.saveCheckpoint(state as any, {
        threadId,
        agentId:
          (state['hermesAgentId'] as string) ?? (state['agentId'] as string),
        ttlSeconds: 86400,
      });
      this.logger.debug(`Checkpoint saved for thread: ${threadId}`);
    } catch (error) {
      this.logger.warn(`Failed to save checkpoint: ${error}`);
    }
  }

  async load(threadId: string): Promise<Record<string, unknown> | null> {
    try {
      if (!this.checkpointService.isAvailable()) {
        return null;
      }
      const state = await this.checkpointService.loadCheckpoint(
        threadId,
        undefined,
      );
      return state as Record<string, unknown> | null;
    } catch (error) {
      this.logger.warn(`Failed to load checkpoint: ${error}`);
      return null;
    }
  }
}
