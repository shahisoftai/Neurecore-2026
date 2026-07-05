import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IHermesSession,
  HermesSessionData,
  HermesMessageData,
} from '../interfaces/hermes-session.interface';

@Injectable()
export class HermesSessionService implements IHermesSession {
  private readonly logger = new Logger(HermesSessionService.name);

  constructor(private readonly prisma: PrismaService) {}

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
  ): Promise<HermesMessageData> {
    const message = await this.prisma.hermesMessage.create({
      data: {
        sessionId,
        role,
        content,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        metadata: (metadata as any) ?? undefined,
      },
    });
    return {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      metadata: (message.metadata as Record<string, unknown>) ?? undefined,
      toolCalls: (message.toolCalls as unknown) ?? undefined,
      toolResults: (message.toolResults as unknown) ?? undefined,
      error: message.error ?? undefined,
      createdAt: message.createdAt,
    };
  }

  async getMessages(sessionId: string): Promise<HermesMessageData[]> {
    const messages = await this.prisma.hermesMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
    return messages.map((m) => ({
      id: m.id,
      sessionId: m.sessionId,
      role: m.role,
      content: m.content,
      metadata: (m.metadata as Record<string, unknown>) ?? undefined,
      toolCalls: (m.toolCalls as unknown) ?? undefined,
      toolResults: (m.toolResults as unknown) ?? undefined,
      error: m.error ?? undefined,
      createdAt: m.createdAt,
    }));
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
}
