import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import {
  THREAD_SERVICE,
  type IThreadService,
} from '../interfaces/IThreadService';
import type {
  CreateSessionWithThreadParams,
  IHermesSession,
  HermesSessionData,
  HermesMessageData,
  MentionRef,
} from '../interfaces/hermes-session.interface';

@Injectable()
export class HermesSessionService implements IHermesSession {
  private readonly logger = new Logger(HermesSessionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
    @Inject(THREAD_SERVICE) private readonly threadService: IThreadService,
  ) {}

  async create(
    hermesAgentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ): Promise<HermesSessionData> {
    const session = await this.prisma.hermesSession.create({
      data: {
        hermesAgentId,
        userId,
        tenantId,
        workspaceId,
        context: {},
      },
    });
    return {
      id: session.id,
      hermesAgentId: session.hermesAgentId,
      userId: session.userId,
      tenantId: session.tenantId,
      workspaceId: session.workspaceId ?? undefined,
      threadId: session.threadId,
      status: session.status,
      context: (session.context as Record<string, unknown>) ?? {},
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt ?? undefined,
    };
  }

  /**
   * Phase 1: create a session attached to a CommunicationThread.
   *
   * - If `params.threadId` is provided, verify the thread exists + is in
   *   the same tenant, then create a session with that thread's id and
   *   ensure the caller (`userId` as USER) is a participant.
   * - If no `params.threadId`, auto-create a thread with caller + agent
   *   as initial participants, then attach the new session to it.
   */
  async createWithThread(
    params: CreateSessionWithThreadParams,
  ): Promise<HermesSessionData> {
    let resolvedThreadId = params.threadId;

    if (resolvedThreadId) {
      const thread = await this.prisma.communicationThread.findUnique({
        where: { id: resolvedThreadId },
        select: { tenantId: true },
      });
      if (!thread || thread.tenantId !== params.tenantId) {
        throw new Error(
          `Thread ${resolvedThreadId} not found in tenant ${params.tenantId}`,
        );
      }
      // Ensure the user is a participant (idempotent).
      await this.threadService.addParticipant(
        resolvedThreadId,
        { type: 'USER', id: params.userId },
        params.tenantId,
      );
    } else {
      const thread = await this.threadService.create({
        tenantId: params.tenantId,
        title: params.threadTitle ?? 'New conversation',
        contextType: params.contextType ?? undefined,
        contextId: params.contextId ?? undefined,
        participants: [
          { type: 'USER', id: params.userId },
          { type: 'AI_AGENT', id: params.hermesAgentId },
        ],
      });
      resolvedThreadId = thread.id;
    }

    const session = await this.prisma.hermesSession.create({
      data: {
        hermesAgentId: params.hermesAgentId,
        userId: params.userId,
        tenantId: params.tenantId,
        workspaceId: params.workspaceId,
        context: { threadId: resolvedThreadId },
      },
    });

    return {
      id: session.id,
      hermesAgentId: session.hermesAgentId,
      userId: session.userId,
      tenantId: session.tenantId,
      workspaceId: session.workspaceId ?? undefined,
      threadId: session.threadId,
      status: session.status,
      context: (session.context as Record<string, unknown>) ?? {},
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt ?? undefined,
    };
  }

  async get(threadId: string): Promise<HermesSessionData | null> {
    const session = await this.prisma.hermesSession.findUnique({
      where: { threadId },
    });
    if (!session) return null;
    return {
      id: session.id,
      hermesAgentId: session.hermesAgentId,
      userId: session.userId,
      tenantId: session.tenantId,
      workspaceId: session.workspaceId ?? undefined,
      threadId: session.threadId,
      status: session.status,
      context: (session.context as Record<string, unknown>) ?? {},
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      expiresAt: session.expiresAt ?? undefined,
    };
  }

  async addMessage(
    sessionId: string,
    role: 'USER' | 'HERMES' | 'SYSTEM',
    content: string,
    metadata?: Record<string, unknown>,
    threadId?: string,
    idempotencyKey?: string,
    mentions?: MentionRef[],
  ): Promise<HermesMessageData> {
    if (idempotencyKey) {
      const existing = await this.prisma.hermesMessage.findUnique({
        where: { idempotencyKey },
      });
      if (existing) {
        return this.toMessage(existing);
      }
    }

    const message = await this.prisma.hermesMessage.create({
      data: {
        sessionId,
        role,
        content,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: (metadata as any) ?? undefined,
        threadId: threadId ?? null,
        idempotencyKey: idempotencyKey ?? null,
        mentions: (mentions as unknown as object) ?? [],
      },
    });

    if (threadId) {
      this.eventsGateway.emitToRoom(
        `thread:${threadId}`,
        'thread:message',
        this.toMessage(message),
      );
    }

    // Phase 9c: @Mention fan-out — see spec §16.3.1.
    // Each mentioned participant receives a targeted `thread:mention` event
    // (in addition to the standard thread-room broadcast above) so the
    // frontend notification badge can highlight direct pings.
    if (mentions && mentions.length > 0 && threadId) {
      for (const mention of mentions) {
        this.eventsGateway.emitToUser(mention.participantId, 'thread:mention', {
          threadId,
          messageId: message.id,
          mentionedBy: { type: role, id: sessionId },
          preview: content.substring(0, 200),
        });
      }
    }

    return this.toMessage(message);
  }

  async getMessages(sessionId: string): Promise<HermesMessageData[]> {
    const messages = await this.prisma.hermesMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => this.toMessage(m));
  }

  async updateStatus(sessionId: string, status: string): Promise<void> {
    await this.prisma.hermesSession.update({
      where: { id: sessionId },
      data: {
        status:
          status === 'completed'
            ? 'COMPLETED'
            : status === 'active'
              ? 'ACTIVE'
              : 'EXPIRED',
      },
    });
  }

  private toMessage(m: {
    id: string;
    sessionId: string;
    threadId: string | null;
    role: 'USER' | 'HERMES' | 'SYSTEM';
    content: string;
    metadata: unknown;
    mentions?: unknown;
    toolCalls: unknown;
    toolResults: unknown;
    error: string | null;
    createdAt: Date;
  }): HermesMessageData {
    return {
      id: m.id,
      sessionId: m.sessionId,
      threadId: m.threadId,
      role: m.role,
      content: m.content,
      metadata: (m.metadata as Record<string, unknown>) ?? undefined,
      mentions: Array.isArray(m.mentions)
        ? (m.mentions as MentionRef[])
        : undefined,
      toolCalls: m.toolCalls ?? undefined,
      toolResults: m.toolResults ?? undefined,
      error: m.error ?? undefined,
      createdAt: m.createdAt,
    };
  }
}
