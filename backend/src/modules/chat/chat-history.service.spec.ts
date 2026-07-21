/**
 * ChatHistoryService — unit tests (Phase B: chat persistence).
 * Verifies saveMessage, getHistory, clearHistory with mocked Prisma.
 */

import { ChatHistoryService } from './chat-history.service';

interface MockSession {
  id: string;
  conversationId: string;
  tenantId: string;
  userId: string;
  lastMessageAt: Date;
}

interface MockMessage {
  id: string;
  sessionId: string;
  conversationId: string;
  tenantId: string;
  userId: string;
  role: string;
  content: string;
  metadata: unknown;
  tokens: unknown;
  model: string | null;
  provider: string | null;
  createdAt: Date;
}

function createMockPrisma() {
  const sessions = new Map<string, MockSession>();
  const messages: MockMessage[] = [];

  const prisma = {
    chatSession: {
      findUnique: jest.fn(
        async ({
          where,
          select,
        }: {
          where: { conversationId: string };
          select: { id: true; tenantId: true; userId: true };
        }) => {
          const s = sessions.get(where.conversationId);
          if (!s) return null;
          return { id: s.id, tenantId: s.tenantId, userId: s.userId };
        },
      ),
      upsert: jest.fn(
        async ({
          where,
          update,
          create,
        }: {
          where: { conversationId: string };
          update: { lastMessageAt: Date };
          create: Omit<MockSession, 'id'>;
        }) => {
          const existing = sessions.get(where.conversationId);
          if (existing) {
            existing.lastMessageAt = update.lastMessageAt;
            return existing;
          }
          const created: MockSession = {
            id: `sess_${sessions.size + 1}`,
            ...create,
          };
          sessions.set(create.conversationId, created);
          return created;
        },
      ),
    },
    chatMessage: {
      create: jest.fn(
        async ({
          data,
        }: {
          data: Omit<MockMessage, 'id' | 'createdAt'> & { createdAt?: Date };
        }) => {
          const msg: MockMessage = {
            id: `msg_${messages.length + 1}`,
            createdAt: data.createdAt ?? new Date(),
            ...data,
          };
          messages.push(msg);
          return msg;
        },
      ),
      findMany: jest.fn(
        async ({
          where,
          orderBy,
          take,
        }: {
          where: { tenantId: string; userId?: string; conversationId?: string };
          orderBy?: { createdAt: 'asc' | 'desc' };
          take?: number;
        }) => {
          let rows = messages.filter((m) => {
            if (m.tenantId !== where.tenantId) return false;
            if (where.userId && m.userId !== where.userId) return false;
            if (
              where.conversationId &&
              m.conversationId !== where.conversationId
            )
              return false;
            return true;
          });
          if (orderBy?.createdAt === 'asc') {
            rows = [...rows].sort(
              (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
            );
          }
          if (typeof take === 'number') rows = rows.slice(0, take);
          return rows;
        },
      ),
      count: jest.fn(
        async ({
          where,
        }: {
          where: { tenantId: string; userId?: string; conversationId?: string };
        }) => {
          return messages.filter((m) => {
            if (m.tenantId !== where.tenantId) return false;
            if (where.userId && m.userId !== where.userId) return false;
            if (
              where.conversationId &&
              m.conversationId !== where.conversationId
            )
              return false;
            return true;
          }).length;
        },
      ),
      deleteMany: jest.fn(
        async ({
          where,
        }: {
          where: { tenantId: string; userId?: string; conversationId?: string };
        }) => {
          const before = messages.length;
          const remaining = messages.filter((m) => {
            if (m.tenantId !== where.tenantId) return false;
            if (where.userId && m.userId !== where.userId) return false;
            if (
              where.conversationId &&
              m.conversationId !== where.conversationId
            )
              return false;
            return true;
          });
          const toDelete = new Set(remaining.map((r) => r.id));
          for (let i = messages.length - 1; i >= 0; i--) {
            if (toDelete.has(messages[i].id)) messages.splice(i, 1);
          }
          return { count: before - messages.length };
        },
      ),
    },
  };

  return { prisma, sessions, messages };
}

describe('ChatHistoryService — Phase B', () => {
  let service: ChatHistoryService;
  let mock: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    mock = createMockPrisma();
    service = new ChatHistoryService(mock.prisma as never);
  });

  describe('saveMessage', () => {
    it('persists a user message and auto-creates a session', async () => {
      const entry = await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'hi',
      });
      expect(entry).not.toBeNull();
      expect(entry?.content).toBe('hi');
      expect(entry?.role).toBe('user');
      expect(mock.sessions.size).toBe(1);
    });

    it('upserts the session on subsequent messages (updates lastMessageAt)', async () => {
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'conv-1',
        role: 'user',
        content: 'first',
      });
      const first = mock.sessions.get('conv-1')!;
      const firstTime = first.lastMessageAt.getTime();

      await new Promise((r) => setTimeout(r, 5));
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'reply',
      });
      expect(mock.sessions.size).toBe(1);
      expect(first.lastMessageAt.getTime()).toBeGreaterThanOrEqual(firstTime);
    });

    it('persists metadata, tokens, model, provider when provided', async () => {
      const entry = await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'conv-2',
        role: 'assistant',
        content: 'reply',
        metadata: { intent: 'query' },
        tokens: { input: 5, output: 10, total: 15 },
        model: 'gpt-x',
        provider: 'openai',
      });
      expect(entry?.tokens?.total).toBe(15);
      expect(entry?.model).toBe('gpt-x');
      expect(entry?.provider).toBe('openai');
      expect(entry?.metadata).toEqual({ intent: 'query' });
    });

    it('returns null and does not throw when prisma fails', async () => {
      const failingPrisma = {
        chatSession: {
          upsert: jest.fn().mockRejectedValue(new Error('db down')),
        },
        chatMessage: { create: jest.fn() },
      };
      const failingService = new ChatHistoryService(failingPrisma as never);
      const entry = await failingService.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'conv-x',
        role: 'user',
        content: 'hi',
      });
      expect(entry).toBeNull();
    });
  });

  describe('getHistory', () => {
    beforeEach(async () => {
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: 'a',
      });
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'assistant',
        content: 'b',
      });
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c2',
        role: 'user',
        content: 'c',
      });
    });

    it('returns all messages for the tenant+user', async () => {
      const r = await service.getHistory({ tenantId: 't1', userId: 'u1' });
      expect(r.total).toBe(3);
      expect(r.data).toHaveLength(3);
    });

    it('filters by conversationId', async () => {
      const r = await service.getHistory({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
      });
      expect(r.data.map((m) => m.content)).toEqual(['a', 'b']);
    });

    it('scopes by tenantId (does not leak other tenants)', async () => {
      const r = await service.getHistory({ tenantId: 'other' });
      expect(r.total).toBe(0);
    });

    it('respects limit', async () => {
      const r = await service.getHistory({
        tenantId: 't1',
        userId: 'u1',
        limit: 2,
      });
      expect(r.data).toHaveLength(2);
    });

    it('caps limit at MAX_LIMIT (500)', async () => {
      const r = await service.getHistory({
        tenantId: 't1',
        userId: 'u1',
        limit: 10_000,
      });
      expect(r.data.length).toBeLessThanOrEqual(500);
    });
  });

  describe('clearHistory', () => {
    beforeEach(async () => {
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: 'a',
      });
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c2',
        role: 'user',
        content: 'b',
      });
    });

    it('clears only the specified conversation', async () => {
      const r = await service.clearHistory({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
      });
      expect(r.deleted).toBe(1);
      const remaining = await service.getHistory({
        tenantId: 't1',
        userId: 'u1',
      });
      expect(remaining.total).toBe(1);
      expect(remaining.data[0].conversationId).toBe('c2');
    });

    it('clears all when no conversationId', async () => {
      const r = await service.clearHistory({ tenantId: 't1', userId: 'u1' });
      expect(r.deleted).toBe(2);
    });
  });
});
