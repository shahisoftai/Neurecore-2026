/**
 * Integration tests for TimelineEventsService.
 *
 * Uses mocked PrismaService. The DB-level trigger that also enforces the
 * transition matrix is verified by the Phase 1 migration tests.
 *
 * Key properties to verify:
 *   - transitionStatus rejects illegal transitions with ILLEGAL_STATUS_TRANSITION
 *   - allowedTransitions returns the correct list for each status
 *   - create rejects when zero actors are set (DB enforces this; we check the app)
 *   - create rejects when multiple actors are set
 */

import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { TimelineEventsService } from './timeline-events.service';
import { TimelineEventStatus } from '@prisma/client';

describe('TimelineEventsService (Phase 1)', () => {
  let service: TimelineEventsService;
  let mockPrisma: any;
  let store: Map<string, any>;

  beforeEach(async () => {
    store = new Map();
    mockPrisma = {
      timelineEvent: {
        create: jest.fn(async ({ data }: any) => {
          const id = 'ev-' + (store.size + 1);
          // Apply Prisma defaults that the real DB would apply
          const rec = {
            id,
            status: data.status ?? 'REPORTED',
            ...data,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          store.set(id, rec);
          return rec;
        }),
        // Helper to inject a record in a specific status (bypassing transition rules)
        __forceCreate: jest.fn((rec: any) => {
          const id = 'ev-' + (store.size + 1);
          const full = { id, createdAt: new Date(), updatedAt: new Date(), ...rec };
          store.set(id, full);
          return full;
        }),
        findFirst: jest.fn(async ({ where }: any) => {
          for (const v of store.values()) {
            // Support both { id, tenantId } and { id_tenantId } shapes
            const matches = (where.id ? v.id === where.id : true) &&
                          (where.tenantId ? v.tenantId === where.tenantId : true);
            if (matches) return v;
          }
          return null;
        }),
        update: jest.fn(async ({ where, data }: any) => {
          for (const [k, v] of store.entries()) {
            if (v.id === where.id) {
              Object.assign(v, data);
              store.set(k, v);
              return v;
            }
          }
          throw new Error('not found');
        }),
        findMany: jest.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [
        TimelineEventsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(TimelineEventsService);
  });

  describe('create', () => {
    it('rejects when zero actors are set', async () => {
      let caught: any = null;
      try {
        await service.create({
          tenantId: 't1',
          category: 'OPERATIONAL',
          severity: 'LOW',
          sourceType: 'HUMAN',
          title: 't',
          description: 'd',
          occurredAt: new Date(),
        });
      } catch (err: any) {
        caught = err;
      }
      expect(caught).not.toBeNull();
      const body = caught?.response ?? caught?.getResponse?.();
      expect(body?.code).toBe('EXACTLY_ONE_ACTOR_REQUIRED');
    });

    it('rejects when multiple actors are set', async () => {
      let caught: any = null;
      try {
        await service.create({
          tenantId: 't1',
          category: 'OPERATIONAL',
          severity: 'LOW',
          sourceType: 'HUMAN',
          title: 't',
          description: 'd',
          occurredAt: new Date(),
          createdByUserId: 'u1',
          createdByAgentId: 'a1',
        });
      } catch (err: any) {
        caught = err;
      }
      expect(caught).not.toBeNull();
      const body = caught?.response ?? caught?.getResponse?.();
      expect(body?.code).toBe('EXACTLY_ONE_ACTOR_REQUIRED');
    });

    it('accepts when exactly one actor is set', async () => {
      const event = await service.create({
        tenantId: 't1',
        category: 'OPERATIONAL',
        severity: 'LOW',
        sourceType: 'HUMAN',
        title: 't',
        description: 'd',
        occurredAt: new Date(),
        createdByUserId: 'u1',
      });
      expect(event.id).toBeDefined();
      expect(store.get(event.id).createdByUserId).toBe('u1');
    });
  });

  describe('allowedTransitions', () => {
    it('returns correct list for DRAFT', () => {
      expect(service.allowedTransitions(TimelineEventStatus.DRAFT))
        .toEqual(['REPORTED', 'FAILED']);
    });

    it('returns correct list for REPORTED', () => {
      expect(service.allowedTransitions(TimelineEventStatus.REPORTED))
        .toEqual(['VERIFIED', 'INVALIDATED', 'CANCELLED']);
    });

    it('returns correct list for VERIFIED', () => {
      expect(service.allowedTransitions(TimelineEventStatus.VERIFIED))
        .toEqual(['ACTIVE', 'INVALIDATED', 'CANCELLED']);
    });

    it('returns correct list for ACTIVE', () => {
      expect(service.allowedTransitions(TimelineEventStatus.ACTIVE))
        .toEqual(['RESOLVED', 'INVALIDATED', 'CANCELLED']);
    });

    it('returns terminal states for terminal statuses', () => {
      expect(service.allowedTransitions(TimelineEventStatus.RESOLVED)).toEqual([]);
      expect(service.allowedTransitions(TimelineEventStatus.INVALIDATED)).toEqual([]);
      expect(service.allowedTransitions(TimelineEventStatus.CANCELLED)).toEqual([]);
    });

    it('returns REPORTED for FAILED (explicit recovery)', () => {
      expect(service.allowedTransitions(TimelineEventStatus.FAILED)).toEqual(['REPORTED']);
    });
  });

  describe('transitionStatus — rejected illegal transitions', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await service.create({
        tenantId: 't1',
        category: 'OPERATIONAL',
        severity: 'LOW',
        sourceType: 'HUMAN',
        title: 't',
        description: 'd',
        occurredAt: new Date(),
        createdByUserId: 'u1',
      });
      eventId = event.id;
    });

    it('rejects FAILED -> ACTIVE (the user-flagged illegal transition)', async () => {
      // Directly inject a FAILED record (simulating the two-phase creation path)
      const failedEvent = mockPrisma.timelineEvent.__forceCreate({
        tenantId: 't1',
        category: 'OPERATIONAL',
        severity: 'LOW',
        sourceType: 'SYSTEM',
        title: 'pre-failed',
        description: 'pre-existing failed event',
        occurredAt: new Date(),
        createdByServiceIdentityId: 'svc-1',
        status: 'FAILED',
      });
      // Try the illegal transition FAILED -> ACTIVE
      let caught: any = null;
      try {
        await service.transitionStatus(failedEvent.id, 't1', TimelineEventStatus.ACTIVE, { userId: 'u1' });
      } catch (err) { caught = err; }
      expect(caught).not.toBeNull();
      const body = caught?.response ?? caught?.getResponse?.();
      expect(body?.code).toBe('ILLEGAL_STATUS_TRANSITION');
    });

    it('rejects REPORTED -> ACTIVE (skips VERIFIED)', async () => {
      // Initial state is REPORTED. Try to skip directly to ACTIVE.
      const ev = await service.findOne(eventId, 't1');
      expect(ev.status).toBe(TimelineEventStatus.REPORTED);
      let caught: any = null;
      try {
        await service.transitionStatus(eventId, 't1', TimelineEventStatus.ACTIVE, { userId: 'u1' });
      } catch (err) { caught = err; }
      expect(caught).not.toBeNull();
      const body = caught?.response ?? caught?.getResponse?.();
      expect(body?.code).toBe('ILLEGAL_STATUS_TRANSITION');
    });

    it('rejects RESOLVED -> ACTIVE (terminal)', async () => {
      await service.transitionStatus(eventId, 't1', TimelineEventStatus.VERIFIED, { userId: 'u1' });
      await service.transitionStatus(eventId, 't1', TimelineEventStatus.ACTIVE, { userId: 'u1' });
      await service.transitionStatus(eventId, 't1', TimelineEventStatus.RESOLVED, { userId: 'u1' });
      let caught: any = null;
      try {
        await service.transitionStatus(eventId, 't1', TimelineEventStatus.ACTIVE, { userId: 'u1' });
      } catch (err) { caught = err; }
      expect(caught).not.toBeNull();
      const body = caught?.response ?? caught?.getResponse?.();
      expect(body?.code).toBe('ILLEGAL_STATUS_TRANSITION');
    });
  });

  describe('transitionStatus — allowed legal transitions', () => {
    let eventId: string;

    beforeEach(async () => {
      const event = await service.create({
        tenantId: 't1',
        category: 'OPERATIONAL',
        severity: 'LOW',
        sourceType: 'HUMAN',
        title: 't',
        description: 'd',
        occurredAt: new Date(),
        createdByUserId: 'u1',
      });
      eventId = event.id;
    });

    it('allows REPORTED -> VERIFIED -> ACTIVE -> RESOLVED', async () => {
      await service.transitionStatus(eventId, 't1', TimelineEventStatus.VERIFIED, { userId: 'u1' });
      await service.transitionStatus(eventId, 't1', TimelineEventStatus.ACTIVE, { userId: 'u1' });
      await service.transitionStatus(eventId, 't1', TimelineEventStatus.RESOLVED, { userId: 'u1' });
      const ev = await service.findOne(eventId, 't1');
      expect(ev.status).toBe(TimelineEventStatus.RESOLVED);
    });

    it('allows FAILED -> REPORTED (explicit recovery path)', async () => {
      // Directly inject a FAILED record
      const failedEvent = mockPrisma.timelineEvent.__forceCreate({
        tenantId: 't1',
        category: 'OPERATIONAL',
        severity: 'LOW',
        sourceType: 'SYSTEM',
        title: 'recovery-test',
        description: 'recovery',
        occurredAt: new Date(),
        createdByServiceIdentityId: 'svc-1',
        status: 'FAILED',
      });
      // Recovery: FAILED -> REPORTED is allowed
      await service.transitionStatus(failedEvent.id, 't1', TimelineEventStatus.REPORTED, { userId: 'u1' });
      const ev = await service.findOne(failedEvent.id, 't1');
      expect(ev.status).toBe(TimelineEventStatus.REPORTED);
    });
  });
});