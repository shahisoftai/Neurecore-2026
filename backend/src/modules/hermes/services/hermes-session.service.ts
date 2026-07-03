import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { HermesSession, HermesMessage, SessionStatus } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { IHermesSession } from '../interfaces/hermes-session.interface';
import type {
  CreateSessionInput,
  AddMessageInput,
  SessionWithMessages,
} from '../interfaces/hermes-session.interface';
import {
  HERMES_SESSION_DEFAULT_EXPIRY_HOURS,
} from '../common/hermes.constants';

@Injectable()
export class HermesSessionService implements IHermesSession {
  private readonly logger = new Logger(HermesSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateSessionInput,
  ): Promise<HermesSession> {
    const expiryDate = new Date();
    expiryDate.setHours(
      expiryDate.getHours() + HERMES_SESSION_DEFAULT_EXPIRY_HOURS,
    );

    const session = await this.prisma.hermesSession.create({
      data: {
        hermesAgentId: input.hermesAgentId,
        userId: input.userId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        context: (input.context ?? {}) as any,
        expiresAt: expiryDate,
      },
    });

    this.logger.log(
      `Created Hermes session ${session.id} for agent ${input.hermesAgentId}`,
    );
    return session;
  }

  async findById(
    id: string,
    tenantId: string,
  ): Promise<SessionWithMessages | null> {
    const session = await this.prisma.hermesSession.findFirst({
      where: { id, tenantId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) return null;

    return {
      ...session,
      messages: session.messages,
      messageCount: session.messages.length,
    };
  }

  async findByAgent(
    hermesAgentId: string,
    tenantId: string,
    limit = 20,
  ): Promise<HermesSession[]> {
    return this.prisma.hermesSession.findMany({
      where: { hermesAgentId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findByUser(
    userId: string,
    tenantId: string,
    limit = 20,
  ): Promise<HermesSession[]> {
    return this.prisma.hermesSession.findMany({
      where: { userId, tenantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async addMessage(
    input: AddMessageInput,
  ): Promise<HermesMessage> {
    const session = await this.prisma.hermesSession.findFirst({
      where: { id: input.sessionId },
    });

    if (!session) {
      throw new NotFoundException(
        `Hermes session ${input.sessionId} not found`,
      );
    }

    const message = await this.prisma.hermesMessage.create({
      data: {
        sessionId: input.sessionId,
        role: input.role,
        content: input.content,
        toolCalls: input.toolCalls as any,
        toolResults: input.toolResults as any,
        error: input.error,
        metadata: input.metadata as any,
      },
    });

    await this.prisma.hermesSession.update({
      where: { id: input.sessionId },
      data: { updatedAt: new Date() },
    });

    return message;
  }

  async getMessages(
    sessionId: string,
    tenantId: string,
    limit = 50,
  ): Promise<HermesMessage[]> {
    return this.prisma.hermesMessage.findMany({
      where: {
        sessionId,
        session: { tenantId },
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
  }

  async getConversationHistory(
    sessionId: string,
  ): Promise<any[]> {
    return this.prisma.hermesMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      select: {
        role: true,
        content: true,
        toolCalls: true,
        toolResults: true,
        createdAt: true,
      },
    }) as any;
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: SessionStatus,
  ): Promise<HermesSession> {
    const session = await this.prisma.hermesSession.findFirst({
      where: { id, tenantId },
    });

    if (!session) {
      throw new NotFoundException(
        `Hermes session ${id} not found`,
      );
    }

    return this.prisma.hermesSession.update({
      where: { id },
      data: { status },
    });
  }

  async closeSession(
    id: string,
    tenantId: string,
  ): Promise<void> {
    const session = await this.prisma.hermesSession.findFirst({
      where: { id, tenantId },
    });

    if (!session) {
      throw new NotFoundException(
        `Hermes session ${id} not found`,
      );
    }

    await this.prisma.hermesSession.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        expiresAt: new Date(),
      },
    });

    this.logger.log(`Closed Hermes session ${id}`);
  }

  async expireStaleSessions(
    tenantId: string,
  ): Promise<number> {
    const result = await this.prisma.hermesSession.updateMany({
      where: {
        tenantId,
        status: 'ACTIVE',
        expiresAt: { lt: new Date() },
      },
      data: {
        status: 'EXPIRED',
      },
    });

    if (result.count > 0) {
      this.logger.log(
        `Expired ${result.count} stale Hermes sessions in tenant ${tenantId}`,
      );
    }

    return result.count;
  }
}
