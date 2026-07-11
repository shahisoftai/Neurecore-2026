import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import type { IAgentMessagingGuard } from '../interfaces/IAgentMessagingGuard';
import type { AgentMessage } from '../interfaces/IAgentMessaging';
import { AGENT_MESSAGING_GUARD } from '../interfaces/IAgentMessagingGuard';

/**
 * AgentMessagingGuard — Phase 4 circuit breaker.
 *
 * Authoritative counters live on CommunicationThread and HermesAuditLog.
 * Client-supplied hop/cost values are ignored.
 */
@Injectable()
export class AgentMessagingGuard implements IAgentMessagingGuard {
  private readonly logger = new Logger(AgentMessagingGuard.name);
  private readonly MAX_HOPS = 5;
  private readonly MAX_MESSAGES_PER_THREAD = 50;
  private readonly MAX_COST_USD_PER_THREAD = 10;

  constructor(
    private readonly prisma: PrismaService,
    private readonly featureFlag: FeatureFlagService,
  ) {}

  async check(message: AgentMessage): Promise<void> {
    const thread = await this.prisma.communicationThread.findUnique({
      where: { id: message.threadId },
      select: { hopCount: true, tenantId: true },
    });
    if (!thread) {
      throw new Error(`Thread ${message.threadId} not found`);
    }
    if (thread.tenantId !== message.tenantId) {
      throw new Error('Thread tenant mismatch');
    }
    if (thread.hopCount >= this.MAX_HOPS) {
      throw new Error(
        `A2A hop limit exceeded: ${thread.hopCount} >= ${this.MAX_HOPS}`,
      );
    }

    const msgCount = await this.prisma.hermesMessage.count({
      where: { threadId: message.threadId },
    });
    if (msgCount >= this.MAX_MESSAGES_PER_THREAD) {
      throw new Error(
        `Thread message limit exceeded: ${msgCount} >= ${this.MAX_MESSAGES_PER_THREAD}`,
      );
    }

    const costAgg = await this.prisma.hermesAuditLog.aggregate({
      where: { threadId: message.threadId },
      _sum: { costUsd: true },
    });
    const totalCost = costAgg._sum.costUsd ?? 0;
    if (totalCost >= this.MAX_COST_USD_PER_THREAD) {
      throw new Error(
        `Thread cost ceiling exceeded: $${totalCost} >= $${this.MAX_COST_USD_PER_THREAD}`,
      );
    }

    const enabled =
      (await this.featureFlag.isEnabled(
        'AGENT_MESSAGING_ENABLED',
        message.tenantId,
      )) ||
      (await this.featureFlag.isEnabled(
        'COMM_AGENT_MESSAGING_ENABLED',
        message.tenantId,
      ));
    if (!enabled) {
      throw new Error('Agent-to-agent messaging is disabled for this tenant');
    }
  }
}

export { AGENT_MESSAGING_GUARD };
