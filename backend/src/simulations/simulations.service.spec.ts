/**
 * Unit + vertical-slice tests for SimulationsService + SimulationsDayRunner.
 *
 * These tests use a fully-mocked PrismaService to verify the vertical slice
 * creates the correct entities and the idempotency/version-gating logic works.
 *
 * Vertical slice entities created on day-run:
 *   1. TimelineEvent (SUPPLY_CHAIN)
 *   2. ProjectDecision
 *   3. CommunicationThread (ai_debate) + 2 hermesMessages
 *   4. CommunicationThread (devil_advocate) + 1 hermesMessage
 *   5. CommunicationThread (auditor_challenge) + 1 hermesMessage
 *   6. ApprovalRequest
 *   7. Task
 *   8. KnowledgeEntry (RUNNING_SCORES placeholder)
 *   9. KnowledgeEntry (AUDIT_FINDING)
 *  10. MissionFeedItem
 *  11. ProjectDecision evaluation (INITIAL)
 *  12. Project metadata checkpoint update
 */

import { ConflictException, BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../infrastructure/database/prisma.service';
import { SimulationsService } from './simulations.service';
import { SimulationsDayRunner } from './simulations.day-runner';
import { TimelineEventsService } from '../modules/timeline-events/timeline-events.service';
import { DecisionEvaluationsService } from '../modules/decision-evaluations/decision-evaluations.service';

describe('SimulationsService + SimulationsDayRunner (Phase 1)', () => {
  let simsService: SimulationsService;
  let dayRunner: SimulationsDayRunner;
  let mockPrisma: any;

  let projectStore: Map<string, any>;
  let identityStore: Map<string, any>;
  let tokenStore: Map<string, any>;
  let threadStore: Map<string, any>;
  let messageStore: Map<string, any>;
  let approvalStore: Map<string, any>;
  let taskStore: Map<string, any>;
  let knowledgeStore: Map<string, any>;
  let feedStore: Map<string, any>;
  let decisionStore: Map<string, any>;
  let evaluationStore: Map<string, any>;
  let timelineEventStore: Map<string, any>;

  beforeEach(async () => {
    projectStore = new Map();
    identityStore = new Map();
    tokenStore = new Map();
    threadStore = new Map();
    messageStore = new Map();
    approvalStore = new Map();
    taskStore = new Map();
    knowledgeStore = new Map();
    feedStore = new Map();
    decisionStore = new Map();
    evaluationStore = new Map();
    timelineEventStore = new Map();

    mockPrisma = {
      project: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'proj-' + (projectStore.size + 1);
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          projectStore.set(id, rec);
          return rec;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          for (const v of projectStore.values()) {
            if (where.metadata?.path && where.metadata?.equals) {
              if (!where.tenantId || v.tenantId === where.tenantId) {
                const meta = v.metadata as any;
                if (meta?.simulation?.simulationId === where.metadata.equals) return v;
              }
            }
            if (v.id === where.id && (!where.tenantId || v.tenantId === where.tenantId)) return v;
          }
          return null;
        }),
        findMany: jest.fn(async ({ where }: any) => {
          return Array.from(projectStore.values()).filter((p) => p.tenantId === where.tenantId);
        }),
        update: jest.fn(async ({ where, data }: any) => {
          for (const [k, v] of projectStore.entries()) {
            if (v.id === where.id) {
              Object.assign(v, data);
              projectStore.set(k, v);
              return v;
            }
          }
          throw new Error('not found');
        }),
      },
      communicationThread: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'thread-' + (threadStore.size + 1);
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          threadStore.set(id, rec);
          return rec;
        }),
      },
      hermesMessage: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'msg-' + (messageStore.size + 1);
          const rec = { id, ...data, createdAt: new Date() };
          messageStore.set(id, rec);
          return rec;
        }),
      },
      approvalRequest: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'approval-' + (approvalStore.size + 1);
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          approvalStore.set(id, rec);
          return rec;
        }),
      },
      task: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'task-' + (taskStore.size + 1);
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          taskStore.set(id, rec);
          return rec;
        }),
      },
      knowledgeEntry: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'knowledge-' + (knowledgeStore.size + 1);
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          knowledgeStore.set(id, rec);
          return rec;
        }),
      },
      missionFeedItem: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'feed-' + (feedStore.size + 1);
          const rec = { id, ...data, createdAt: new Date() };
          feedStore.set(id, rec);
          return rec;
        }),
      },
      projectDecision: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'dec-' + (decisionStore.size + 1);
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          decisionStore.set(id, rec);
          return rec;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          for (const v of decisionStore.values()) {
            if (v.id === where.id) return v;
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
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          evaluationStore.set(id, rec);
          return rec;
        }),
      },
      timelineEvent: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'ev-' + (timelineEventStore.size + 1);
          const rec = { id, ...data, createdAt: new Date(), updatedAt: new Date() };
          timelineEventStore.set(id, rec);
          return rec;
        }),
      },
      $transaction: jest.fn(async (fn: (tx: any) => Promise<any>) => {
        return fn(mockPrisma);
      }),
      $executeRawUnsafe: jest.fn(),
      $queryRawUnsafe: jest.fn(async (sql: string) => {
        if (sql.includes('nextval')) {
          return [{ nextval: BigInt(projectStore.size + 1) }];
        }
        return [];
      }),
    };

    const module = await Test.createTestingModule({
      providers: [
        SimulationsService,
        SimulationsDayRunner,
        TimelineEventsService,
        DecisionEvaluationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    simsService = module.get(SimulationsService);
    dayRunner = module.get(SimulationsDayRunner);
  });

  describe('SimulationsService', () => {
    describe('parseSimulationId', () => {
      it('parses a valid sim:// URI', () => {
        const parts = simsService.parseSimulationId('sim://2026/07/17/acme/test-framework/000001');
        expect(parts).toEqual({ orgSlug: 'acme', framework: 'test-framework', seq: 1 });
      });

      it('returns null for invalid URIs', () => {
        expect(simsService.parseSimulationId('invalid')).toBeNull();
        expect(simsService.parseSimulationId('sim://2026/07/17/acme/test-framework/1')).toBeNull();
        expect(simsService.parseSimulationId('sim://2026/07/17/acme/test_framework/000001')).toBeNull();
      });
    });

    describe('create', () => {
      it('creates a project and control thread in a transaction', async () => {
        const result = await simsService.create({
          tenantId: 't1',
          name: 'AEIC Run 1',
          seed: 'test-seed-123',
          orgSlug: 'acme',
          framework: 'ruf',
          versions: { scoring: 'v1', engine: '1.0.0', framework: '1.0.0' },
          engineConfig: { days: 60 },
        });

        expect(result.simulationId).toMatch(/^sim:\/\/\d{4}\/\d{2}\/\d{2}\/acme\/ruf\/\d{6}$/);
        expect(result.simulationRunId).toBeDefined();
        expect(mockPrisma.$transaction).toHaveBeenCalled();
        expect(mockPrisma.communicationThread.create).toHaveBeenCalled();
      });

      it('sets correct project tags and metadata', async () => {
        await simsService.create({
          tenantId: 't1',
          name: 'AEIC Run 1',
          seed: 'my-seed',
          orgSlug: 'acme',
          framework: 'ruf',
          versions: { scoring: 'v1', engine: '1.0.0', framework: '1.0.0' },
          engineConfig: { days: 60 },
        });

        const project = Array.from(projectStore.values())[0];
        expect(project.tags).toContain('simulation-5');
        expect((project.metadata as any).simulation.seed).toBe('my-seed');
        expect((project.metadata as any).simulation.currentDay).toBe(0);
      });
    });

    describe('get — tenant isolation', () => {
      it('returns SIMULATION_NOT_FOUND for unknown simulationId', async () => {
        await expect(simsService.get('t1', 'sim://2026/07/17/acme/ruf/000001')).rejects.toThrow(NotFoundException);
      });

      it('does NOT leak cross-tenant simulations (returns 404 not 403)', async () => {
        const result = await simsService.create({
          tenantId: 't1',
          name: 'AEIC Run 1',
          seed: 'test',
          orgSlug: 'acme',
          framework: 'ruf',
          versions: { scoring: 'v1', engine: '1.0.0', framework: '1.0.0' },
          engineConfig: {},
        });
        const t1SimId = result.simulationId;

        await expect(simsService.get('t2', t1SimId)).rejects.toThrow(NotFoundException);
      });
    });

    describe('list', () => {
      it('returns only this tenant\'s simulations', async () => {
        const r1 = await simsService.create({
          tenantId: 't1', name: 't1-run', seed: 's', orgSlug: 'acme', framework: 'ruf',
          versions: { scoring: 'v1', engine: '1.0.0', framework: '1.0.0' }, engineConfig: {},
        });
        await simsService.create({
          tenantId: 't2', name: 't2-run', seed: 's', orgSlug: 'acme', framework: 'ruf',
          versions: { scoring: 'v1', engine: '1.0.0', framework: '1.0.0' }, engineConfig: {},
        });

        const t1List = await simsService.list('t1');
        expect(t1List.items.length).toBe(1);
        expect(t1List.items[0].simulationId).toBe(r1.simulationId);
      });
    });
  });

  describe('SimulationsDayRunner — vertical slice', () => {
    let projectId: string;
    let simId: string;
    const VERSIONS = { scoring: 'v1', engine: '1.0.0', framework: '1.0.0' };

    beforeEach(async () => {
      const created = await simsService.create({
        tenantId: 't1',
        name: 'AEIC Run 1',
        seed: 'test',
        orgSlug: 'acme',
        framework: 'ruf',
        versions: VERSIONS,
        engineConfig: {},
      });
      projectId = created.simulationRunId;
      simId = created.simulationId;
    });

    describe('runDay — entity creation', () => {
      it('creates all 10 vertical-slice entities', async () => {
        const result = await dayRunner.runDay({
          tenantId: 't1',
          simulationId: simId,
          day: 1,
          expectedVersions: VERSIONS,
          actorUserId: 'u1',
        });

        expect(result.status).toBe('COMPLETED');
        expect(result.created.timelineEvents.length).toBe(1);
        expect(result.created.decisions.length).toBe(1);
        expect(result.created.threads.length).toBe(3); // debate + devil_advocate + auditor
        expect(result.created.approvals.length).toBe(1);
        expect(result.created.tasks.length).toBe(1);
        expect(result.created.knowledgeEntries.length).toBe(2); // RUNNING_SCORES + AUDIT_FINDING
        expect(result.created.feedItems.length).toBe(1);
      });

      it('creates a ProjectDecision linked to the TimelineEvent as evidence', async () => {
        await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 1,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        const decision = Array.from(decisionStore.values())[0];
        expect(decision.evidenceRefs[0].entityType).toBe('TimelineEvent');
        expect(decision.simulationId).toBe(simId);
      });

      it('creates a DecisionEvaluation after day run', async () => {
        await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 1,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        expect(evaluationStore.size).toBe(1);
        const eval_ = Array.from(evaluationStore.values())[0];
        expect(eval_.evaluationKind).toBe('INITIAL');
        expect(eval_.scoringVersion).toBe('v1');
      });

      it('creates knowledge entries with SIMULATION_ONLY visibility', async () => {
        await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 1,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        const knowledgeEntries = Array.from(knowledgeStore.values());
        expect(knowledgeEntries.every((k: any) => k.visibilityScope === 'SIMULATION_ONLY')).toBe(true);
      });

      it('creates a MissionFeedItem linked to the decision', async () => {
        await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 1,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        const feed = Array.from(feedStore.values())[0];
        expect(feed.entityType).toBe('ProjectDecision');
        expect(feed.simulationId).toBe(simId);
      });
    });

    describe('runDay — validation gates', () => {
      it('rejects VERSION_MISMATCH when expectedVersions differ from stored', async () => {
        await expect(
          dayRunner.runDay({
            tenantId: 't1', simulationId: simId, day: 1,
            expectedVersions: { scoring: 'v99', engine: '1.0.0', framework: '1.0.0' },
            actorUserId: 'u1',
          }),
        ).rejects.toThrow(ConflictException);
      });

      it('rejects INVALID_DAY when day is out of range', async () => {
        await expect(
          dayRunner.runDay({
            tenantId: 't1', simulationId: simId, day: 0,
            expectedVersions: VERSIONS, actorUserId: 'u1',
          }),
        ).rejects.toThrow(BadRequestException);

        await expect(
          dayRunner.runDay({
            tenantId: 't1', simulationId: simId, day: 61,
            expectedVersions: VERSIONS, actorUserId: 'u1',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('rejects DAY_ALREADY_RUN when same day is run twice', async () => {
        await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 1,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        await expect(
          dayRunner.runDay({
            tenantId: 't1', simulationId: simId, day: 1,
            expectedVersions: VERSIONS, actorUserId: 'u1',
          }),
        ).rejects.toThrow(ConflictException);
      });

      it('rejects INVALID_DAY for day 0', async () => {
        await expect(
          dayRunner.runDay({
            tenantId: 't1', simulationId: simId, day: 0,
            expectedVersions: VERSIONS, actorUserId: 'u1',
          }),
        ).rejects.toThrow(BadRequestException);
      });

      it('allows day 2 after day 1', async () => {
        await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 1,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        const result = await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 2,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        expect(result.status).toBe('COMPLETED');
        expect(result.created.decisions.length).toBe(1);
      });
    });

    describe('runDay — scores', () => {
      it('computes deterministic organizational intelligence scores', async () => {
        const result = await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 1,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        expect(result.scores.organizationalIntelligence.scoringVersion).toBe('v1');
        expect(result.scores.organizationalIntelligence.grade).toBeDefined();
        expect(result.scores.organizationalIntelligence.byCategory).toBeDefined();
      });

      it('platformHealth is null (not yet implemented)', async () => {
        const result = await dayRunner.runDay({
          tenantId: 't1', simulationId: simId, day: 1,
          expectedVersions: VERSIONS, actorUserId: 'u1',
        });

        expect(result.scores.platformHealth).toBeNull();
        expect(result.scores.productionReady).toBe(false);
      });
    });
  });
});
