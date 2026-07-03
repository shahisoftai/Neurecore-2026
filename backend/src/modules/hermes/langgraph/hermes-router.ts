import { Logger } from '@nestjs/common';
import { selectHermesAgent } from './hermes-node';
import type { HermesRegistryService } from '../services/hermes-registry.service';
import type { HermesSessionService } from '../services/hermes-session.service';

const logger = new Logger('HermesRouter');

export class HermesRouter {
  constructor(
    private readonly registryService: HermesRegistryService,
    private readonly sessionService: HermesSessionService,
  ) {}

  async route(
    task: string,
    tenantId: string,
    userId: string,
    workspaceId?: string,
  ): Promise<{
    hermesAgentId: string;
    hermesType: string;
    sessionId: string;
    confidence: number;
  } | null> {
    const selected = await selectHermesAgent(
      task,
      tenantId,
      this.registryService,
    );

    if (!selected) {
      logger.warn(
        `No Hermes agent found for task in tenant ${tenantId}`,
      );
      return null;
    }

    logger.log(
      `[HermesRouter] Selected agent ${selected.agentId} (${selected.agentType}) with score ${selected.score}`,
    );

    const session = await this.sessionService.create({
      hermesAgentId: selected.agentId,
      userId,
      tenantId,
      workspaceId,
    });

    return {
      hermesAgentId: selected.agentId,
      hermesType: selected.agentType,
      sessionId: session.id,
      confidence: selected.score,
    };
  }
}
