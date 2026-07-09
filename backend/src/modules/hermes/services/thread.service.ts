import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import type { CommunicationThread, ParticipantType } from '@prisma/client';
import {
  THREAD_SERVICE,
  type CreateThreadParams,
  type GetMessagesOpts,
  type IThreadService,
  type ThreadParticipantInput,
  type ThreadRequester,
} from '../interfaces/IThreadService';

/**
 * ThreadService — Phase 1 of the Enterprise Communication Platform.
 *
 * Owns the persistent thread abstraction. HermesSession becomes one
 * producer of messages into a thread, not the owner. Every read
 * enforces participant membership to prevent tenant-wide data leaks.
 */
@Injectable()
export class ThreadService implements IThreadService {
  private readonly logger = new Logger(ThreadService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  async create(params: CreateThreadParams): Promise<CommunicationThread> {
    const thread = await this.prisma.communicationThread.create({
      data: {
        tenantId: params.tenantId,
        title: params.title,
        contextType: params.contextType ?? null,
        contextId: params.contextId ?? null,
        participants: {
          create: params.participants.map((p) => ({
            participantType: p.type,
            participantId: p.id,
            role: p.role ?? null,
          })),
        },
      },
    });

    this.eventsGateway.emitToTenant(
      params.tenantId,
      'thread:created',
      this.toData(thread),
    );

    return thread;
  }

  async get(
    threadId: string,
    requester: ThreadRequester,
  ): Promise<CommunicationThread | null> {
    const thread = await this.prisma.communicationThread.findUnique({
      where: { id: threadId },
    });
    if (!thread) return null;
    if (thread.tenantId !== requester.tenantId) return null;

    const isMember = await this.prisma.threadParticipant.findUnique({
      where: {
        threadId_participantType_participantId: {
          threadId,
          participantType: requester.type,
          participantId: requester.id,
        },
      },
    });
    if (!isMember) return null;
    return thread;
  }

  async findForEntity(
    contextType: string,
    contextId: string,
    tenantId: string,
  ): Promise<CommunicationThread[]> {
    return this.prisma.communicationThread.findMany({
      where: { contextType, contextId, tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async addParticipant(
    threadId: string,
    participant: ThreadParticipantInput,
    requesterTenantId: string,
  ): Promise<void> {
    const thread = await this.prisma.communicationThread.findUnique({
      where: { id: threadId },
      select: { tenantId: true },
    });
    if (!thread) throw new Error(`Thread ${threadId} not found`);
    if (thread.tenantId !== requesterTenantId) {
      throw new Error('Tenant mismatch when adding thread participant');
    }

    await this.prisma.threadParticipant.upsert({
      where: {
        threadId_participantType_participantId: {
          threadId,
          participantType: participant.type,
          participantId: participant.id,
        },
      },
      update: {
        isActive: true,
        leftAt: null,
        role: participant.role ?? undefined,
      },
      create: {
        threadId,
        participantType: participant.type,
        participantId: participant.id,
        role: participant.role ?? null,
      },
    });

    this.eventsGateway.emitToRoom(
      `thread:${threadId}`,
      'thread:participant_added',
      {
        threadId,
        participant,
      },
    );
  }

  async getMessages(
    threadId: string,
    requester: ThreadRequester,
    opts?: GetMessagesOpts,
  ): Promise<
    Array<{
      id: string;
      sessionId: string;
      threadId: string | null;
      role: 'USER' | 'HERMES' | 'SYSTEM';
      content: string;
      metadata?: Record<string, unknown>;
      createdAt: Date;
    }>
  > {
    const thread = await this.prisma.communicationThread.findUnique({
      where: { id: threadId },
      select: { tenantId: true },
    });
    if (!thread || thread.tenantId !== requester.tenantId) return [];

    const isMember = await this.prisma.threadParticipant.findUnique({
      where: {
        threadId_participantType_participantId: {
          threadId,
          participantType: requester.type,
          participantId: requester.id,
        },
      },
    });
    if (!isMember) return [];

    const limit = Math.min(200, Math.max(1, opts?.limit ?? 50));
    const messages = await this.prisma.hermesMessage.findMany({
      where: {
        threadId,
        ...(opts?.before ? { id: { lt: opts.before } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        sessionId: true,
        threadId: true,
        role: true,
        content: true,
        metadata: true,
        createdAt: true,
      },
    });

    return messages.reverse().map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      threadId: m.threadId,
      role: m.role,
      content: m.content,
      metadata: (m.metadata as Record<string, unknown> | null) ?? undefined,
      createdAt: m.createdAt,
    }));
  }

  async markRead(
    threadId: string,
    participantType: ParticipantType,
    participantId: string,
  ): Promise<void> {
    const latest = await this.prisma.hermesMessage.findFirst({
      where: { threadId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    await this.prisma.threadReadState.upsert({
      where: {
        threadId_participantType_participantId: {
          threadId,
          participantType,
          participantId,
        },
      },
      update: {
        lastReadMessageId: latest?.id ?? null,
        lastReadAt: new Date(),
      },
      create: {
        threadId,
        participantType,
        participantId,
        lastReadMessageId: latest?.id ?? null,
      },
    });
  }

  async getUnreadCount(
    participantType: ParticipantType,
    participantId: string,
    tenantId: string,
  ): Promise<number> {
    const threads = await this.prisma.communicationThread.findMany({
      where: {
        tenantId,
        participants: {
          some: { participantType, participantId, isActive: true },
        },
      },
      select: {
        id: true,
        readStates: {
          where: { participantType, participantId },
          select: { lastReadMessageId: true, lastReadAt: true },
        },
      },
    });

    if (threads.length === 0) return 0;

    let total = 0;
    for (const t of threads) {
      const state = t.readStates[0];
      if (!state) {
        const count = await this.prisma.hermesMessage.count({
          where: { threadId: t.id },
        });
        total += count;
        continue;
      }
      const count = await this.prisma.hermesMessage.count({
        where: {
          threadId: t.id,
          createdAt: { gt: state.lastReadAt },
        },
      });
      total += count;
    }
    return total;
  }

  async close(threadId: string, tenantId: string): Promise<void> {
    const thread = await this.prisma.communicationThread.findUnique({
      where: { id: threadId },
      select: { tenantId: true },
    });
    if (!thread || thread.tenantId !== tenantId) return;

    await this.prisma.communicationThread.update({
      where: { id: threadId },
      data: { status: 'CLOSED', closedAt: new Date() },
    });

    this.eventsGateway.emitToTenant(tenantId, 'thread:closed', { threadId });
  }

  async incrementHopCount(threadId: string): Promise<number> {
    const updated = await this.prisma.communicationThread.update({
      where: { id: threadId },
      data: { hopCount: { increment: 1 } },
      select: { hopCount: true },
    });
    return updated.hopCount;
  }

  private toData(thread: CommunicationThread) {
    return {
      id: thread.id,
      tenantId: thread.tenantId,
      title: thread.title,
      contextType: thread.contextType,
      contextId: thread.contextId,
      status: thread.status,
      hopCount: thread.hopCount,
      createdAt: thread.createdAt,
      updatedAt: thread.updatedAt,
      closedAt: thread.closedAt,
    };
  }
}

export { THREAD_SERVICE };
