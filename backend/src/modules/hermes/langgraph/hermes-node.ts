import { Injectable, Logger } from '@nestjs/common';
import { HermesRuntimeService } from '../services/hermes-runtime.service';

export interface HermesNodeState {
  goal: string;
  hermesAgentId: string;
  sessionId: string;
  context: {
    tenantId: string;
    workspaceId?: string;
    userId?: string;
    threadId: string;
    agentId?: string;
  };
}

@Injectable()
export class HermesNode {
  private readonly logger = new Logger(HermesNode.name);

  constructor(private readonly runtime: HermesRuntimeService) {}

  async execute(state: HermesNodeState): Promise<{
    hermesResult: unknown;
    messages: Array<{ role: string; content: string; timestamp: number }>;
  }> {
    this.logger.log(`HermesNode executing for agent: ${state.hermesAgentId}`);

    const result = await this.runtime.execute({
      sessionId: state.sessionId,
      hermesAgentId: state.hermesAgentId,
      task: state.goal,
      context: {
        tenantId: state.context.tenantId,
        workspaceId: state.context.workspaceId,
        userId: state.context.userId,
        threadId: state.context.threadId,
        agentId: state.context.agentId,
      },
    });

    const messages: Array<{
      role: string;
      content: string;
      timestamp: number;
    }> = [
      { role: 'user', content: state.goal, timestamp: Date.now() },
      {
        role: 'assistant',
        content: JSON.stringify(result.output ?? result),
        timestamp: Date.now(),
      },
    ];

    return {
      hermesResult: result,
      messages,
    };
  }
}
