import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { Prisma } from '@prisma/client';
import type {
  HermesSessionDescriptor,
  HermesMessageDescriptor,
  PaginatedResult,
  SessionFindOpts,
  AddMessageInput,
} from '../interfaces/hermes-session.interface';
import type { SessionStatus, MessageRole } from '@prisma/client';
import { randomUUID } from 'crypto';

@Injectable()
export class HermesSessionService {
  private readonly logger = new Logger(HermesSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    agentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ): Promise<HermesSessionDescriptor> {
    const threadId = randomUUID();

    const session = await this.prisma.hermesSession.create({
      data: {
        hermesAgentId: agentId,
        userId,
        tenantId,
        workspaceId,
        threadId,
        status: 'ACTIVE',
        context: {},
      },
    });

    this.logger.log(
      `[HermesSession] Created session ${session.id} for agent ${agentId}`,
    );
    return this.toDescriptor(session);
  }

  async findById(
    sessionId: string,
    tenantId: string,
  ): Promise<HermesSessionDescriptor | null> {
    const session = await this.prisma.hermesSession.findFirst({
      where: { id: sessionId, tenantId },
      include: { _count: { select: { messages: true } } },
    });
    return session
      ? this.toDescriptor(session, { messageCount: session._count.messages })
      : null;
  }

  async findByThread(
    threadId: string,
    tenantId: string,
  ): Promise<HermesSessionDescriptor | null> {
    const session = await this.prisma.hermesSession.findFirst({
      where: { threadId, tenantId },
      include: { _count: { select: { messages: true } } },
    });
    return session
      ? this.toDescriptor(session, { messageCount: session._count.messages })
      : null;
  }

  async findByAgent(
    agentId: string,
    tenantId: string,
    opts?: SessionFindOpts,
  ): Promise<PaginatedResult<HermesSessionDescriptor>> {
    const { page = 1, limit = 20, status, userId } = opts ?? {};
    const skip = (page - 1) * limit;

    const where = {
      hermesAgentId: agentId,
      tenantId,
      ...(status && { status }),
      ...(userId && { userId }),
    };

    const [data, total] = await this.prisma.$transaction([
      this.prisma.hermesSession.findMany({
        where,
        skip,
        take: limit,
        include: { _count: { select: { messages: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.hermesSession.count({ where }),
    ]);

    return {
      data: data.map((s) =>
        this.toDescriptor(s, { messageCount: s._count.messages }),
      ),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async addMessage(
    sessionId: string,
    input: AddMessageInput,
    tenantId: string,
  ): Promise<HermesMessageDescriptor> {
    await this.assertSessionExists(sessionId, tenantId);

    const message = await this.prisma.hermesMessage.create({
      data: {
        sessionId,
        role: input.role,
        content: input.content,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        toolCalls: (input.toolCalls
          ? JSON.parse(JSON.stringify(input.toolCalls))
          : []) as Prisma.InputJsonValue,
        toolResults: (input.toolResults
          ? JSON.parse(JSON.stringify(input.toolResults))
          : []) as Prisma.InputJsonValue,
        error: input.error,
      },
    });

    await this.prisma.hermesSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() },
    });

    return this.toMessageDescriptor(message);
  }

  async getMessages(
    sessionId: string,
    tenantId: string,
    limit = 100,
  ): Promise<HermesMessageDescriptor[]> {
    await this.assertSessionExists(sessionId, tenantId);

    const messages = await this.prisma.hermesMessage.findMany({
      where: { sessionId },
      take: limit,
      orderBy: { createdAt: 'asc' },
    });

    return messages.map((m) => this.toMessageDescriptor(m));
  }

  async updateStatus(
    sessionId: string,
    status: SessionStatus,
    tenantId: string,
  ): Promise<HermesSessionDescriptor> {
    await this.assertSessionExists(sessionId, tenantId);

    const session = await this.prisma.hermesSession.update({
      where: { id: sessionId },
      data: { status },
      include: { _count: { select: { messages: true } } },
    });

    return this.toDescriptor(session, {
      messageCount: session._count.messages,
    });
  }

  async extend(sessionId: string, tenantId: string, hours = 24): Promise<void> {
    await this.assertSessionExists(sessionId, tenantId);
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);
    await this.prisma.hermesSession.update({
      where: { id: sessionId },
      data: { expiresAt },
    });
  }

  async archive(sessionId: string, tenantId: string): Promise<void> {
    await this.assertSessionExists(sessionId, tenantId);
    await this.prisma.hermesSession.update({
      where: { id: sessionId },
      data: { status: 'COMPLETED' as SessionStatus },
    });
  }

  async getActiveCount(agentId: string, tenantId: string): Promise<number> {
    return this.prisma.hermesSession.count({
      where: { hermesAgentId: agentId, tenantId, status: 'ACTIVE' },
    });
  }

  private async assertSessionExists(
    id: string,
    tenantId: string,
  ): Promise<void> {
    const exists = await this.prisma.hermesSession.findFirst({
      where: { id, tenantId },
      select: { id: true },
    });
    if (!exists) {
      throw new NotFoundException(`HermesSession ${id} not found`);
    }
  }

  private toDescriptor(
    session: Record<string, unknown> & { _count?: { messages: number } },
    extras?: { messageCount: number },
  ): HermesSessionDescriptor {
    return {
      id: session['id'] as string,
      hermesAgentId: session['hermesAgentId'] as string,
      userId: session['userId'] as string,
      tenantId: session['tenantId'] as string,
      workspaceId: session['workspaceId'] as string | undefined,
      threadId: session['threadId'] as string,
      status: session['status'] as SessionStatus,
      context: (session['context'] as Record<string, unknown>) ?? {},
      messageCount: extras?.messageCount ?? session['_count']?.messages ?? 0,
      createdAt: session['createdAt'] as Date,
      updatedAt: session['updatedAt'] as Date,
      expiresAt: session['expiresAt'] as Date | undefined,
    };
  }

  private toMessageDescriptor(
    msg: Record<string, unknown>,
  ): HermesMessageDescriptor {
    return {
      id: msg['id'] as string,
      sessionId: msg['sessionId'] as string,
      role: msg['role'] as MessageRole,
      content: msg['content'] as string,
      metadata: msg['metadata'] as Record<string, unknown> | undefined,
      toolCalls: msg['toolCalls'] as HermesMessageDescriptor['toolCalls'],
      toolResults: msg['toolResults'] as HermesMessageDescriptor['toolResults'],
      error: msg['error'] as string | undefined,
      createdAt: msg['createdAt'] as Date,
    };
  }
}
