import { HermesMemoryService } from '../../src/modules/hermes/services/hermes-memory.service';
import { HermesMemoryType } from '@prisma/client';

function buildMocks() {
  const prisma: any = {
    hermesMemoryEntry: {
      create: jest.fn().mockImplementation((args) => Promise.resolve({
        id: 'mem-1',
        hermesAgentId: args.data.hermesAgentId,
        tenantId: args.data.tenantId,
        workspaceId: args.data.workspaceId,
        type: args.data.type,
        content: args.data.content,
        summary: args.data.summary,
        importance: args.data.importance,
        source: args.data.source,
        metadata: args.data.metadata,
        expiresAt: args.data.expiresAt,
        embedding: args.data.embedding,
        createdAt: new Date(),
        updatedAt: new Date(),
      })),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue({}),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };

  const config: any = {
    get: jest.fn().mockReturnValue(null),
  };

  const svc = new HermesMemoryService(prisma, config);
  return { svc, prisma, config };
}

describe('HermesMemoryService', () => {
  let svc: HermesMemoryService;
  let prisma: any;

  beforeEach(() => {
    const mocks = buildMocks();
    svc = mocks.svc;
    prisma = mocks.prisma;
    jest.clearAllMocks();
  });

  describe('store', () => {
    it('should store a memory entry', async () => {
      const result = await svc.store({
        hermesAgentId: 'agent-1',
        type: HermesMemoryType.PERSONAL,
        content: 'Test memory content',
        summary: 'Test summary',
        importance: 0.8,
        source: 'test',
      }, 'tenant-1');

      expect(result.hermesAgentId).toBe('agent-1');
      expect(result.content).toBe('Test memory content');
      expect(result.type).toBe(HermesMemoryType.PERSONAL);
      expect(prisma.hermesMemoryEntry.create).toHaveBeenCalled();
    });

    it('should set default importance if not provided', async () => {
      const result = await svc.store({
        hermesAgentId: 'agent-1',
        type: HermesMemoryType.EPISODIC,
        content: 'Test',
      }, 'tenant-1');

      expect(result.importance).toBe(0.5);
    });
  });

  describe('search', () => {
    it('should return empty array when no results', async () => {
      prisma.hermesMemoryEntry.findMany.mockResolvedValueOnce([]);

      const results = await svc.search('agent-1', 'query', 'tenant-1');
      expect(results).toEqual([]);
    });

    it('should respect limit option', async () => {
      const entries = Array(15).fill(null).map((_, i) => ({
        id: `mem-${i}`,
        hermesAgentId: 'agent-1',
        tenantId: 'tenant-1',
        workspaceId: null,
        type: HermesMemoryType.PERSONAL,
        content: `Content ${i}`,
        summary: null,
        importance: 0.5,
        source: null,
        metadata: {},
        expiresAt: null,
        embedding: [0.1, 0.2],
        createdAt: new Date(),
        updatedAt: new Date(),
      }));

      prisma.hermesMemoryEntry.findMany.mockResolvedValueOnce(entries.slice(0, 10));

      const results = await svc.search('agent-1', 'query', 'tenant-1', { limit: 10 });
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should filter by type when provided', async () => {
      await svc.search('agent-1', 'query', 'tenant-1', { type: HermesMemoryType.PROCEDURAL });
      expect(prisma.hermesMemoryEntry.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: HermesMemoryType.PROCEDURAL }),
        }),
      );
    });
  });

  describe('getContext', () => {
    it('should return empty string when no entries', async () => {
      prisma.hermesMemoryEntry.findMany.mockResolvedValueOnce([]);

      const result = await svc.getContext('agent-1', 'tenant-1', 5);
      expect(result).toBe('');
    });

    it('should format entries as context string', async () => {
      prisma.hermesMemoryEntry.findMany.mockResolvedValueOnce([
        {
          type: HermesMemoryType.PERSONAL,
          summary: 'Test summary',
          content: 'Test content',
          createdAt: new Date(),
        },
      ]);

      const result = await svc.getContext('agent-1', 'tenant-1', 5);
      expect(result).toContain('[PERSONAL]');
      expect(result).toContain('Test summary');
    });
  });

  describe('rememberEpisode', () => {
    it('should store an episodic memory entry', async () => {
      await svc.rememberEpisode('agent-1', 'tenant-1', 'Completed invoice processing');
      expect(prisma.hermesMemoryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hermesAgentId: 'agent-1',
            tenantId: 'tenant-1',
            type: HermesMemoryType.EPISODIC,
            content: 'Completed invoice processing',
          }),
        }),
      );
    });
  });

  describe('forget', () => {
    it('should delete memory entry by id', async () => {
      prisma.hermesMemoryEntry.findFirst.mockResolvedValueOnce({ id: 'mem-1' });
      await svc.forget('agent-1', 'mem-1', 'tenant-1');
      expect(prisma.hermesMemoryEntry.delete).toHaveBeenCalledWith({ where: { id: 'mem-1' } });
    });

    it('should not throw when entry not found', async () => {
      prisma.hermesMemoryEntry.findFirst.mockResolvedValueOnce(null);
      await expect(svc.forget('agent-1', 'nonexistent', 'tenant-1')).resolves.not.toThrow();
    });
  });

  describe('getProceduralMemory', () => {
    it('should return null when no procedural memory found', async () => {
      prisma.hermesMemoryEntry.findMany.mockResolvedValueOnce([]);
      const result = await svc.getProceduralMemory('agent-1', 'invoice processing', 'tenant-1');
      expect(result).toBeNull();
    });
  });

  describe('storeProceduralMemory', () => {
    it('should store a procedural memory entry', async () => {
      await svc.storeProceduralMemory('agent-1', 'tenant-1', 'invoice processing', 'Step 1: validate...');
      expect(prisma.hermesMemoryEntry.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            hermesAgentId: 'agent-1',
            tenantId: 'tenant-1',
            type: HermesMemoryType.PROCEDURAL,
          }),
        }),
      );
    });
  });

  describe('getStats', () => {
    it('should return stats object', async () => {
      prisma.hermesMemoryEntry.groupBy.mockResolvedValueOnce([
        { type: HermesMemoryType.PERSONAL, _count: 5 },
        { type: HermesMemoryType.EPISODIC, _count: 3 },
        { type: HermesMemoryType.PROCEDURAL, _count: 2 },
      ]);
      prisma.hermesMemoryEntry.findFirst.mockResolvedValueOnce({ createdAt: new Date('2024-01-01') });
      prisma.hermesMemoryEntry.findFirst.mockResolvedValueOnce({ createdAt: new Date('2024-06-01') });

      const stats = await svc.getStats('agent-1', 'tenant-1');
      expect(stats.personal).toBe(5);
      expect(stats.episodic).toBe(3);
      expect(stats.procedural).toBe(2);
      expect(stats.total).toBe(10);
    });
  });

  describe('purgeExpired', () => {
    it('should delete expired entries and return count', async () => {
      prisma.hermesMemoryEntry.deleteMany.mockResolvedValueOnce({ count: 3 });
      const result = await svc.purgeExpired('tenant-1');
      expect(result).toBe(3);
    });
  });
});
