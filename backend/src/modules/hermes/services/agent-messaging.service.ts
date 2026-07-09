import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  HERMES_RUNTIME,
  type IHermesRuntime,
} from '../interfaces/hermes-runtime.interface';
import { HermesSessionService } from './hermes-session.service';
import {
  AGENT_MESSAGING,
  type IAgentMessaging,
  type AgentMessage,
  type AgentMessagingResult,
} from '../interfaces/IAgentMessaging';
import {
  AGENT_MESSAGING_GUARD,
  type IAgentMessagingGuard,
} from '../interfaces/IAgentMessagingGuard';
import {
  THREAD_SERVICE,
  type IThreadService,
} from '../interfaces/IThreadService';
import {
  PARTICIPANT_RESOLVER,
  type IParticipantResolver,
} from '../interfaces/IParticipantResolver';
import {
  ACTIVITY_SERVICE,
  type IActivityService,
} from '../interfaces/IActivityService';
import type { HermesMessageData } from '../interfaces/hermes-session.interface';
import type { ParticipantType } from '@prisma/client';

/**
 * AgentMessagingService — Phase 4.
 *
 * Routes a message from one agent to another, with circuit-breaker
 * protection, idempotency, server-side hop-count increment, and
 * thread-scoped activity logging.
 */
@Injectable()
export class AgentMessagingService implements IAgentMessaging {
  private readonly logger = new Logger(AgentMessagingService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(HERMES_RUNTIME) private readonly runtime: IHermesRuntime,
    @Inject(THREAD_SERVICE) private readonly threadService: IThreadService,
    private readonly session: HermesSessionService,
    @Inject(PARTICIPANT_RESOLVER) private readonly resolver: IParticipantResolver,
    @Inject(AGENT_MESSAGING_GUARD) private readonly guard: IAgentMessagingGuard,
    @Inject(ACTIVITY_SERVICE) private readonly activityService: IActivityService,
  ) {}

  async send(message: AgentMessage): Promise<AgentMessagingResult> {
    try {
      await this.guard.check(message);
    } catch (err) {
      return {
        delivered: false,
        blocked: err instanceof Error ? err.message : String(err),
      };
    }

    const target = await this.resolver.resolve(
      'AI_AGENT',
      message.toAgentId,
      message.tenantId,
    );
    if (!target) return { delivered: false, blocked: 'Target agent not found' };

    const sourceAgent = await this.resolver.resolve(
      'AI_AGENT',
      message.fromAgentId,
      message.tenantId,
    );

    // Ensure both agents are thread participants so visibility checks work
    // for downstream thread reads (see spec §3.5).
    await this.threadService.addParticipant(
      message.threadId,
      { type: 'AI_AGENT', id: message.fromAgentId },
      message.tenantId,
    );
    await this.threadService.addParticipant(
      message.threadId,
      { type: 'AI_AGENT', id: message.toAgentId },
      message.tenantId,
    );

    const session = await this.session.create(
      message.toAgentId,
      message.fromAgentId,
      message.tenantId,
    );

    await this.session.addMessage(
      session.id,
      'USER',
      message.content,
      { fromAgentId: message.fromAgentId, source: 'agent-messaging' },
      message.threadId,
      message.idempotencyKey,
    );

    const updated = await this.threadService.incrementHopCount(
      message.threadId,
    );

    await this.activityService.record({
      tenantId: message.tenantId,
      actorType: 'AI_AGENT',
      actorId: message.fromAgentId,
      type: 'agent:message_sent',
      title: `${sourceAgent?.displayName ?? message.fromAgentId} → ${target.displayName}`,
      threadId: message.threadId,
      payload: {
        fromAgentId: message.fromAgentId,
        toAgentId: message.toAgentId,
        hopCount: updated,
        expectResponse: message.expectResponse,
      },
      sourceEventId: message.idempotencyKey ?? `agent-msg:${message.id}`,
      expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
    });

    if (!message.expectResponse) {
      return { delivered: true };
    }

    try {
      const result = await this.runtime.execute({
        sessionId: session.id,
        hermesAgentId: message.toAgentId,
        task: message.content,
        context: {
          tenantId: message.tenantId,
          threadId: message.threadId,
          agentId: message.fromAgentId,
          hopCount: updated,
        },
      });

      const reply = result.success
        ? typeof result.output === 'string'
          ? result.output
          : JSON.stringify(result.output)
        : `Error: ${result.error ?? 'unknown'}`;
      await this.session.addMessage(
        session.id,
        'HERMES',
        reply,
        { source: 'agent-messaging-response' },
        message.threadId,
      );

      await this.activityService.record({
        tenantId: message.tenantId,
        actorType: 'AI_AGENT',
        actorId: message.toAgentId,
        type: 'agent:replied',
        title: `${target.displayName} replied`,
        threadId: message.threadId,
        payload: {
          hopCount: updated,
          success: result.success,
          costUsd: result.costUsd,
        },
        sourceEventId: `agent-reply:${session.id}:${updated}`,
        expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      });

      return { delivered: true, response: reply };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Agent execution failed: ${msg}`);
      return { delivered: false, blocked: msg };
    }
  }

  async createChannel(
    agentIdA: string,
    agentIdB: string,
    tenantId: string,
  ): Promise<string> {
    const thread = await this.threadService.create({
      tenantId,
      title: `A2A: ${agentIdA} ↔ ${agentIdB}`,
      contextType: 'AGENT_PAIR',
      contextId: [agentIdA, agentIdB].sort().join(':'),
      participants: [
        { type: 'AI_AGENT', id: agentIdA },
        { type: 'AI_AGENT', id: agentIdB },
      ],
    });
    return thread.id;
  }

  async getConversation(
    threadId: string,
    participant: { type: ParticipantType; id: string; tenantId: string },
  ): Promise<HermesMessageData[]> {
    return this.threadService.getMessages(threadId, participant);
  }
}

export { AGENT_MESSAGING };
