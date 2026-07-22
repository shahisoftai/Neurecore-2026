/**
 * Unit tests for DecisionEvaluationsService.
 *
 * Key properties:
 *   - Immutable: creates with no updates
 *   - Atomic: evaluation + latestEvaluationId update in a transaction
 *   - Tenant isolation: rejects decisions from other tenants
 *   - Scoring version validation: must match /^[a-z0-9.-]+$/
 */

import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { DecisionEvaluationsService } from './decision-evaluations.service';

describe('DecisionEvaluationsService (Phase 1)', () => {
  let service: DecisionEvaluationsService;
  let mockPrisma: any;

  let decisionStore: Map<string, any>;
  let evaluationStore: Map<string, any>;

  beforeEach(async () => {
    decisionStore = new Map();
    evaluationStore = new Map();

    mockPrisma = {
      projectDecision: {
        findFirst: jest.fn(async ({ where }: any) => {
          for (const d of decisionStore.values()) {
            if (d.id === where.id && (!where['project.tenantId'] || d.tenantId === where['project.tenantId'])) {
              return d;
            }
          }
          return null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          for (const [k, v] of decisionStore.entries()) {
            if (v.id === where.id) {
              Object.assign(v, data);
              decisionStore.set(k, v);
              return v;
            }
          }
          throw new Error('not found');
        }),
      },
      decisionEvaluation: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'eval-' + (evaluationStore.size + 1);
          const rec = {
            id,
            tenantId: data.tenantId,
            decisionId: data.decisionId,
            simulationId: data.simulationId ?? null,
            evaluationKind: data.evaluationKind,
            scoringVersion: data.scoringVersion,
            scores: data.scores,
            evaluatorKind: data.evaluatorKind,
            evaluatorId: data.evaluatorId ?? null,
            notes: data.notes ?? null,
            metadata: data.metadata ?? {},
            evaluatedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          evaluationStore.set(id, rec);
          return rec;
        }),
        findMany: jest.fn(async ({ where, orderBy }: any) => {
          const results: any[] = [];
          for (const v of evaluationStore.values()) {
            if (v.decisionId === where.decisionId && v.tenantId === where.tenantId) {
              results.push(v);
            }
          }
          const field = orderBy?.evaluatedAt ? 'evaluatedAt' : null;
          if (field) {
            const dir = orderBy[field] as string;
            results.sort((a, b) => {
              const av = (a as any)[field]?.getTime?.() ?? 0;
              const bv = (b as any)[field]?.getTime?.() ?? 0;
              if (av !== bv) return dir === 'desc' ? bv - av : av - bv;
              return dir === 'desc'
                ? (b.id > a.id ? 1 : -1)
                : (a.id > b.id ? 1 : -1);
            });
          }
          return results;
        }),
        findFirst: jest.fn(async ({ where, orderBy }: any) => {
          let candidates = Array.from(evaluationStore.values()).filter(
            (v) =>
              (!where.id || v.id === where.id) &&
              (!where.decisionId || v.decisionId === where.decisionId) &&
              (!where.tenantId || v.tenantId === where.tenantId),
          );
          if (!orderBy) return candidates[0] ?? null;
          const field = Object.keys(orderBy)[0];
          const dir = orderBy[field] as string;
          candidates.sort((a, b) => {
            const av = (a as any)[field]?.getTime?.() ?? 0;
            const bv = (b as any)[field]?.getTime?.() ?? 0;
            if (av !== bv) return dir === 'desc' ? bv - av : av - bv;
            return dir === 'desc'
              ? (b.id > a.id ? 1 : -1)
              : (a.id > b.id ? 1 : -1);
          });
          return candidates[0] ?? null;
        }),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
        return fn(mockPrisma);
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        DecisionEvaluationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(DecisionEvaluationsService);
  });

  const setupDecision = (id: string, tenantId: string) => {
    const decision = { id, tenantId, latestEvaluationId: null, title: 'test' };
    decisionStore.set(id, decision);
    return decision;
  };

  describe('create', () => {
    it('rejects invalid scoringVersion format', async () => {
      setupDecision('dec-1', 't1');
      await expect(
        service.create({
          tenantId: 't1',
          decisionId: 'dec-1',
          evaluationKind: 'RETROSPECTIVE',
          scoringVersion: 'v1!',
          scores: {},
          evaluatorKind: 'AI',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts valid scoringVersion formats', async () => {
      setupDecision('dec-1', 't1');
      const valid = ['v1', 'v1.0.0', 'v1.2.3-alpha', 'v1.2.3-beta.1'];
      for (const sv of valid) {
        evaluationStore.clear();
        const result = await service.create({
          tenantId: 't1',
          decisionId: 'dec-1',
          evaluationKind: 'RETROSPECTIVE',
          scoringVersion: sv,
          scores: {},
          evaluatorKind: 'AI',
        });
        expect(result.scoringVersion).toBe(sv);
      }
    });

    it('throws DECISION_NOT_FOUND when decision does not exist', async () => {
      await expect(
        service.create({
          tenantId: 't1',
          decisionId: 'nonexistent',
          evaluationKind: 'RETROSPECTIVE',
          scoringVersion: 'v1',
          scores: {},
          evaluatorKind: 'AI',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws DECISION_NOT_FOUND when decision belongs to different tenant', async () => {
      const decision = { id: 'dec-1', tenantId: 't2', projectTenantId: 't2', latestEvaluationId: null };
      decisionStore.set('dec-1', decision);
      mockPrisma.projectDecision.findFirst = jest.fn(async ({ where }: any) => {
        if (where.id === 'dec-1' && where.project?.tenantId === 't1') return null;
        if (where.id === 'dec-1') return decision;
        return null;
      });
      await expect(
        service.create({
          tenantId: 't1',
          decisionId: 'dec-1',
          evaluationKind: 'RETROSPECTIVE',
          scoringVersion: 'v1',
          scores: {},
          evaluatorKind: 'AI',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('creates evaluation and updates decision latestEvaluationId atomically', async () => {
      const decision = setupDecision('dec-1', 't1');
      expect(decision.latestEvaluationId).toBeNull();

      const eval_ = await service.create({
        tenantId: 't1',
        decisionId: 'dec-1',
        simulationId: 'sim-1',
        evaluationKind: 'RETROSPECTIVE',
        scoringVersion: 'v1',
        scores: { overall: 85 },
        evaluatorKind: 'AI',
        evaluatorId: 'agent-1',
        notes: 'good work',
        metadata: { source: 'simulation' },
      });

      expect(eval_.decisionId).toBe('dec-1');
      expect(eval_.scores).toEqual({ overall: 85 });
      expect(mockPrisma.$transaction).toHaveBeenCalled();
      const updatedDecision = decisionStore.get('dec-1');
      expect(updatedDecision.latestEvaluationId).toBe(eval_.id);
    });
  });

  describe('listForDecision', () => {
    it('returns all evaluations for a decision ordered by evaluatedAt desc', async () => {
      setupDecision('dec-1', 't1');
      await service.create({ tenantId: 't1', decisionId: 'dec-1', evaluationKind: 'REAL_TIME', scoringVersion: 'v1', scores: {}, evaluatorKind: 'AI' });
      await service.create({ tenantId: 't1', decisionId: 'dec-1', evaluationKind: 'RETROSPECTIVE', scoringVersion: 'v1', scores: {}, evaluatorKind: 'HUMAN' });

      const results = await service.listForDecision('dec-1', 't1');
      expect(results.length).toBe(2);
      expect(results[0].evaluationKind).toBe('RETROSPECTIVE');
      expect(results[1].evaluationKind).toBe('REAL_TIME');
    });

    it('returns only evaluations for the correct tenant', async () => {
      setupDecision('dec-1', 't1');
      await service.create({ tenantId: 't1', decisionId: 'dec-1', evaluationKind: 'RETROSPECTIVE', scoringVersion: 'v1', scores: {}, evaluatorKind: 'AI' });
      decisionStore.set('dec-2', { id: 'dec-2', tenantId: 't2', latestEvaluationId: null });
      evaluationStore.clear();
      await service.create({ tenantId: 't2', decisionId: 'dec-2', evaluationKind: 'RETROSPECTIVE', scoringVersion: 'v1', scores: {}, evaluatorKind: 'AI' });

      const results = await service.listForDecision('dec-1', 't1');
      expect(results.every((r: any) => r.tenantId === 't1')).toBe(true);
    });
  });

  describe('findOne', () => {
    it('returns the evaluation if found', async () => {
      setupDecision('dec-1', 't1');
      const created = await service.create({ tenantId: 't1', decisionId: 'dec-1', evaluationKind: 'RETROSPECTIVE', scoringVersion: 'v1', scores: {}, evaluatorKind: 'AI' });

      const found = await service.findOne(created.id, 't1');
      expect(found.id).toBe(created.id);
    });

    it('throws NOT_FOUND for unknown evaluation', async () => {
      await expect(service.findOne('nonexistent', 't1')).rejects.toThrow(NotFoundException);
    });

    it('throws NOT_FOUND when evaluation belongs to different tenant', async () => {
      setupDecision('dec-1', 't1');
      const created = await service.create({ tenantId: 't1', decisionId: 'dec-1', evaluationKind: 'RETROSPECTIVE', scoringVersion: 'v1', scores: {}, evaluatorKind: 'AI' });

      await expect(service.findOne(created.id, 't2')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getLatestForDecision', () => {
    it('returns the most recent evaluation', async () => {
      setupDecision('dec-1', 't1');
      await service.create({ tenantId: 't1', decisionId: 'dec-1', evaluationKind: 'REAL_TIME', scoringVersion: 'v1', scores: { score: 70 }, evaluatorKind: 'AI' });
      await service.create({ tenantId: 't1', decisionId: 'dec-1', evaluationKind: 'RETROSPECTIVE', scoringVersion: 'v1', scores: { score: 90 }, evaluatorKind: 'AI' });

      const latest = await service.getLatestForDecision('dec-1', 't1');
      expect(latest).not.toBeNull();
      expect(latest!.evaluationKind).toBe('RETROSPECTIVE');
      expect(latest!.scores).toEqual({ score: 90 });
    });
  });
});
