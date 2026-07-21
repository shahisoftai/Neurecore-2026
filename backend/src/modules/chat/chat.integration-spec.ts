/**
 * Chat Persistence Integration Spec — Phase F
 *
 * Tests the chat persistence round-trip end-to-end via the ChatHistoryService,
 * wired with a mocked PrismaService (no DB required). This is the
 * integration boundary that proves send → save → fetch → clear works
 * the same way it would against a real PostgreSQL backend.
 *
 * The HTTP controller layer is tested separately via full E2E with a live
 * backend (Phase G production verification). This spec focuses on the
 * service-layer integration contract.
 */

import { ChatHistoryService } from './chat-history.service';
import { PrismaService } from '../../infrastructure/database/prisma.service';

// ── In-memory Prisma mock ─────────────────────────────────────────────────────
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

function buildMockPrisma() {
  const sessions = new Map<string, MockSession>();
  const messages: MockMessage[] = [];
  let counter = 0;

  return {
    chatSession: {
      findUnique: jest.fn(async ({ where }: any) => {
        const s = sessions.get(where.conversationId);
        if (!s) return null;
        return { id: s.id, tenantId: s.tenantId, userId: s.userId };
      }),
      upsert: jest.fn(async ({ where, update, create }: any) => {
        const existing = sessions.get(where.conversationId);
        if (existing) {
          existing.lastMessageAt = update.lastMessageAt;
          return existing;
        }
        const created: MockSession = {
          id: `sess_${++counter}`,
          ...create,
        };
        sessions.set(create.conversationId, created);
        return created;
      }),
    },
    chatMessage: {
      create: jest.fn(async ({ data }: any) => {
        const msg: MockMessage = {
          id: `msg_${++counter}`,
          createdAt: new Date(),
          ...data,
        };
        messages.push(msg);
        return msg;
      }),
      findMany: jest.fn(async ({ where, orderBy, take }: any) => {
        let rows = messages.filter((m) => {
          if (m.tenantId !== where.tenantId) return false;
          if (where.userId && m.userId !== where.userId) return false;
          if (where.conversationId && m.conversationId !== where.conversationId)
            return false;
          return true;
        });
        if (orderBy?.createdAt === 'asc')
          rows = [...rows].sort(
            (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
          );
        if (typeof take === 'number') rows = rows.slice(0, take);
        return rows;
      }),
      count: jest.fn(async ({ where }: any) => {
        return messages.filter((m) => {
          if (m.tenantId !== where.tenantId) return false;
          if (where.userId && m.userId !== where.userId) return false;
          if (where.conversationId && m.conversationId !== where.conversationId)
            return false;
          return true;
        }).length;
      }),
      deleteMany: jest.fn(async ({ where }: any) => {
        const before = messages.length;
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          if (
            m.tenantId === where.tenantId &&
            (!where.userId || m.userId === where.userId) &&
            (!where.conversationId ||
              m.conversationId === where.conversationId)
          ) {
            messages.splice(i, 1);
          }
        }
        return { count: before - messages.length };
      }),
    },
  };
}

describe('ChatHistoryService (integration)', () => {
  let service: ChatHistoryService;
  let mockPrisma: ReturnType<typeof buildMockPrisma>;

  beforeEach(() => {
    mockPrisma = buildMockPrisma();
    service = new ChatHistoryService(mockPrisma as unknown as PrismaService);
  });

  // ── Round-trip persistence ───────────────────────────────────────────────
  describe('Persistence round-trip', () => {
    it('send → save → fetch → message persists', async () => {
      // 1. Save user message
      const userEntry = await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: 'hello',
      });
      expect(userEntry).not.toBeNull();
      expect(userEntry?.content).toBe('hello');

      // 2. Save assistant reply
      const asstEntry = await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'assistant',
        content: 'hi back',
        tokens: { input: 5, output: 8, total: 13 },
        model: 'test-model',
        provider: 'test',
      });
      expect(asstEntry).not.toBeNull();

      // 3. Fetch
      const history = await service.getHistory({
        tenantId: 't1',
        conversationId: 'c1',
      });
      expect(history.total).toBe(2);
      expect(history.data[0].role).toBe('user');
      expect(history.data[1].role).toBe('assistant');
      expect(history.data[1].tokens?.total).toBe(13);
    });

    it('clear → fetch → empty', async () => {
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: 'hello',
      });
      const cleared = await service.clearHistory({
        tenantId: 't1',
        conversationId: 'c1',
      });
      expect(cleared.deleted).toBe(1);
      const after = await service.getHistory({
        tenantId: 't1',
        conversationId: 'c1',
      });
      expect(after.total).toBe(0);
    });

    it('session upsert (auto-create on first message)', async () => {
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c-new',
        role: 'user',
        content: 'first',
      });
      expect(mockPrisma.chatSession.upsert).toHaveBeenCalledTimes(1);

      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c-new',
        role: 'assistant',
        content: 'reply',
      });
      // Still only one upsert — the second message updates the same session
      expect(mockPrisma.chatSession.upsert).toHaveBeenCalledTimes(2);
    });

    it('concurrent messages in same conversation share a session', async () => {
      await Promise.all([
        service.saveMessage({
          tenantId: 't1',
          userId: 'u1',
          conversationId: 'c-concurrent',
          role: 'user',
          content: 'msg1',
        }),
        service.saveMessage({
          tenantId: 't1',
          userId: 'u1',
          conversationId: 'c-concurrent',
          role: 'user',
          content: 'msg2',
        }),
      ]);
      const history = await service.getHistory({
        tenantId: 't1',
        conversationId: 'c-concurrent',
      });
      expect(history.total).toBe(2);
    });
  });

  // ── Tenant isolation ─────────────────────────────────────────────────────
  describe('Tenant isolation', () => {
    it('does not leak messages across tenants', async () => {
      // Phase 3.5: ownership check prevents cross-tenant conversationId reuse.
      // Each tenant must use their own conversationId.
      await service.saveMessage({
        tenantId: 'tenant-A',
        userId: 'u1',
        conversationId: 'c-A',
        role: 'user',
        content: 'A secret',
      });
      await service.saveMessage({
        tenantId: 'tenant-B',
        userId: 'u1',
        conversationId: 'c-B',
        role: 'user',
        content: 'B secret',
      });

      const aHistory = await service.getHistory({ tenantId: 'tenant-A' });
      const bHistory = await service.getHistory({ tenantId: 'tenant-B' });

      expect(aHistory.total).toBe(1);
      expect(bHistory.total).toBe(1);
      expect(aHistory.data[0].content).toBe('A secret');
      expect(bHistory.data[0].content).toBe('B secret');
    });

    it('rejects reuse of a conversationId by a different tenant (ownership check)', async () => {
      // First: tenant-A creates conversationId 'c1'
      await service.saveMessage({
        tenantId: 'tenant-A',
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: 'A secret',
      });
      // Phase 3.5: tenant-B trying to use the same conversationId must be rejected
      await expect(
        service.saveMessage({
          tenantId: 'tenant-B',
          userId: 'u1',
          conversationId: 'c1',
          role: 'user',
          content: 'B secret',
        }),
      ).rejects.toThrow('Conversation is owned by a different tenant or user.');
    });
  });

  // ── Failure resilience ───────────────────────────────────────────────────
  describe('Failure resilience', () => {
    it('returns null when Prisma fails on save', async () => {
      const failingPrisma = {
        chatSession: {
          findUnique: jest.fn().mockResolvedValue(null),
          upsert: jest.fn().mockImplementation(() => Promise.reject(new Error('db down'))),
        },
        chatMessage: { create: jest.fn() },
      };
      const failingService = new ChatHistoryService(
        failingPrisma as unknown as PrismaService,
      );
      const entry = await failingService.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: 'hi',
      });
      expect(entry).toBeNull();
    });

    it('returns empty array when Prisma fails on get', async () => {
      const failingPrisma = {
        chatMessage: {
          findMany: jest.fn().mockRejectedValue(new Error('db down')),
          count: jest.fn().mockResolvedValue(0),
        },
      };
      const failingService = new ChatHistoryService(
        failingPrisma as unknown as PrismaService,
      );
      const result = await failingService.getHistory({ tenantId: 't1' });
      expect(result).toEqual({ data: [], total: 0 });
    });
  });

  // ── Persistence ordering ─────────────────────────────────────────────────
  describe('Ordering', () => {
    it('returns messages in chronological (asc) order', async () => {
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: 'first',
      });
      await new Promise((r) => setTimeout(r, 5));
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'assistant',
        content: 'second',
      });
      await new Promise((r) => setTimeout(r, 5));
      await service.saveMessage({
        tenantId: 't1',
        userId: 'u1',
        conversationId: 'c1',
        role: 'user',
        content: 'third',
      });

      const history = await service.getHistory({
        tenantId: 't1',
        conversationId: 'c1',
      });
      expect(history.data.map((m) => m.content)).toEqual([
        'first',
        'second',
        'third',
      ]);
    });
  });
});
