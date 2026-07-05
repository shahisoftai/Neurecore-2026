import { Injectable, Logger } from '@nestjs/common';
import type { IHermesContext } from '../interfaces/hermes-context.interface';
import type { HermesSessionContext } from '../common/hermes.types';
import { HermesMemoryService } from './hermes-memory.service';
import { HermesRegistryService } from './hermes-registry.service';

@Injectable()
export class HermesContextService implements IHermesContext {
  private readonly logger = new Logger(HermesContextService.name);

  constructor(
    private readonly registry: HermesRegistryService,
    private readonly memory: HermesMemoryService,
  ) {}

  async build(params: {
    hermesAgentId: string;
    agentId: string;
    tenantId: string;
    userId?: string;
    workspaceId?: string;
    threadId: string;
  }): Promise<HermesSessionContext> {
    const profile = await this.registry.findById(params.hermesAgentId);

    const memoryContext = await this.memory.getContext(
      params.hermesAgentId,
      params.tenantId,
    );

    const allowedTools = profile
      ? this.registry.getAllowedTools(profile.type)
      : [];

    return {
      threadId: params.threadId,
      hermesAgentId: params.hermesAgentId,
      userId: params.userId,
      tenantId: params.tenantId,
      workspaceId: params.workspaceId,
      memoryContext: memoryContext || undefined,
      allowedTools,
    };
  }
}
