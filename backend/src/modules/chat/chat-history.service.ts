// ─── ChatHistoryService ────────────────────────────────────────────────────────
// SRP: Persists chat messages to PostgreSQL; exposes get/clear history APIs.
// DIP: Depends on PrismaService (DB abstraction).
//
// Independent of Hermes (which is agent-execution-scoped). Chat history is a
// user/tenant concern, not an agent concern.

import { Injectable, Logger, Optional } from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { MetricsService } from '../metrics/metrics.service';

export interface ChatHistoryEntry {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown> | null;
  tokens?: { input: number; output: number; total: number } | null;
  model?: string | null;
  provider?: string | null;
  createdAt: string;
}

export interface GetHistoryParams {
  tenantId: string;
  userId?: string;
  conversationId?: string;
  limit?: number;
}

export interface ClearHistoryParams {
  tenantId: string;
  userId?: string;
  conversationId?: string;
}

const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;

@Injectable()
export class ChatHistoryService {
  private readonly logger = new Logger(ChatHistoryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  /**
   * Persist a single chat message. Auto-creates the session row if needed.
   * Failures are logged but never thrown — chat flow must not break on
   * persistence errors (persistence is observability, not a critical path).
   */
  async saveMessage(params: {
    tenantId: string;
    userId: string;
    conversationId: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    metadata?: Record<string, unknown>;
    tokens?: { input: number; output: number; total: number };
    model?: string;
    provider?: string;
  }): Promise<ChatHistoryEntry | null> {
    try {
      const session = await this.prisma.chatSession.upsert({
        where: { conversationId: params.conversationId },
        update: { lastMessageAt: new Date() },
        create: {
          conversationId: params.conversationId,
          tenantId: params.tenantId,
          userId: params.userId,
          lastMessageAt: new Date(),
        },
      });

      const msg = await this.prisma.chatMessage.create({
        data: {
          sessionId: session.id,
          conversationId: params.conversationId,
          tenantId: params.tenantId,
          userId: params.userId,
          role: params.role,
          content: params.content,
          ...(params.metadata ? { metadata: params.metadata as object } : {}),
          ...(params.tokens
            ? { tokens: params.tokens as unknown as object }
            : {}),
          ...(params.model ? { model: params.model } : {}),
          ...(params.provider ? { provider: params.provider } : {}),
        },
      });

      // Record metric on success only (already-persisted messages)
      this.metrics?.chatMessagesTotal.inc({ role: params.role, endpoint: 'messages' });
      return this.toEntry(msg);
    } catch (err) {
      this.logger.warn(
        `[chat-history] saveMessage failed: ${(err as Error).message}`,
      );
      return null;
    }
  }

  async getHistory(params: GetHistoryParams): Promise<{
    data: ChatHistoryEntry[];
    total: number;
  }> {
    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, MAX_LIMIT);

    const where = {
      tenantId: params.tenantId,
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.conversationId
        ? { conversationId: params.conversationId }
        : {}),
    };

    try {
      const [rows, total] = await Promise.all([
        this.prisma.chatMessage.findMany({
          where,
          orderBy: { createdAt: 'asc' },
          take: limit,
        }),
        this.prisma.chatMessage.count({ where }),
      ]);

      this.metrics?.chatHistoryOpsTotal.inc({ operation: 'get', result: 'ok' });
      return { data: rows.map((r) => this.toEntry(r)), total };
    } catch (err) {
      this.logger.warn(
        `[chat-history] getHistory failed: ${(err as Error).message}`,
      );
      this.metrics?.chatHistoryOpsTotal.inc({ operation: 'get', result: 'error' });
      return { data: [], total: 0 };
    }
  }

  async clearHistory(params: ClearHistoryParams): Promise<{ deleted: number }> {
    const where = {
      tenantId: params.tenantId,
      ...(params.userId ? { userId: params.userId } : {}),
      ...(params.conversationId
        ? { conversationId: params.conversationId }
        : {}),
    };

    try {
      const result = await this.prisma.chatMessage.deleteMany({ where });
      this.metrics?.chatHistoryOpsTotal.inc({ operation: 'delete', result: 'ok' });
      return { deleted: result.count };
    } catch (err) {
      this.logger.warn(
        `[chat-history] clearHistory failed: ${(err as Error).message}`,
      );
      this.metrics?.chatHistoryOpsTotal.inc({ operation: 'delete', result: 'error' });
      return { deleted: 0 };
    }
  }

  private toEntry(msg: {
    id: string;
    conversationId: string;
    role: string;
    content: string;
    metadata: unknown;
    tokens: unknown;
    model: string | null;
    provider: string | null;
    createdAt: Date;
  }): ChatHistoryEntry {
    return {
      id: msg.id,
      conversationId: msg.conversationId,
      role: msg.role as ChatHistoryEntry['role'],
      content: msg.content,
      metadata: (msg.metadata as Record<string, unknown> | null) ?? null,
      tokens: (msg.tokens as ChatHistoryEntry['tokens'] | null) ?? null,
      model: msg.model,
      provider: msg.provider,
      createdAt: msg.createdAt.toISOString(),
    };
  }
}
