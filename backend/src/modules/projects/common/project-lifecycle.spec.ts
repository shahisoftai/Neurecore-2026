/**
 * project-lifecycle.spec.ts — State machine unit tests.
 *
 * Covers:
 *  - Every valid transition in PROJECT_TRANSITIONS
 *  - Every invalid transition (should return false)
 *  - requiresLostReason('LOST') returns true
 *  - requiresLostReason() returns false for all non-LOST statuses
 *  - ARCHIVED is terminal (no outgoing transitions)
 *  - All 9 statuses are covered
 */

import {
  canTransition,
  requiresLostReason,
  PROJECT_TRANSITIONS,
  type ProjectStatus,
} from './project-lifecycle';

const ALL_STATUSES: ProjectStatus[] = [
  'LEAD',
  'PROPOSAL_SENT',
  'WON',
  'LOST',
  'ACTIVE',
  'ON_HOLD',
  'REVIEW',
  'COMPLETED',
  'ARCHIVED',
];

describe('project-lifecycle state machine', () => {
  describe('PROJECT_TRANSITIONS', () => {
    it('covers all 9 statuses', () => {
      const keys = Object.keys(PROJECT_TRANSITIONS) as ProjectStatus[];
      expect(keys.toSorted()).toEqual([...ALL_STATUSES].sort());
    });

    it('ARCHIVED is terminal (no outgoing transitions)', () => {
      expect(PROJECT_TRANSITIONS['ARCHIVED']).toEqual([]);
    });
  });

  describe('canTransition', () => {
    // ─── Valid transitions ──────────────────────────────────────────

    const validTransitions: [ProjectStatus, ProjectStatus][] = [
      ['LEAD', 'PROPOSAL_SENT'],
      ['PROPOSAL_SENT', 'WON'],
      ['PROPOSAL_SENT', 'LOST'],
      ['WON', 'ACTIVE'],
      ['LOST', 'ARCHIVED'],
      ['ACTIVE', 'ON_HOLD'],
      ['ACTIVE', 'REVIEW'],
      ['ACTIVE', 'COMPLETED'],
      ['ON_HOLD', 'ACTIVE'],
      ['REVIEW', 'ACTIVE'],
      ['REVIEW', 'COMPLETED'],
      ['COMPLETED', 'ARCHIVED'],
    ];

    test.each(validTransitions)('%s → %s is valid', (from, to) => {
      expect(canTransition(from, to)).toBe(true);
    });

    // ─── Invalid transitions from each status ───────────────────────

    it('LEAD cannot transition to anything other than PROPOSAL_SENT', () => {
      ALL_STATUSES.forEach((to) => {
        if (to !== 'PROPOSAL_SENT') {
          expect(canTransition('LEAD', to)).toBe(false);
        }
      });
    });

    it('PROPOSAL_SENT cannot transition to anything other than WON or LOST', () => {
      ALL_STATUSES.forEach((to) => {
        if (to !== 'WON' && to !== 'LOST') {
          expect(canTransition('PROPOSAL_SENT', to)).toBe(false);
        }
      });
    });

    it('WON cannot transition to anything other than ACTIVE', () => {
      ALL_STATUSES.forEach((to) => {
        if (to !== 'ACTIVE') {
          expect(canTransition('WON', to)).toBe(false);
        }
      });
    });

    it('LOST cannot transition to anything other than ARCHIVED', () => {
      ALL_STATUSES.forEach((to) => {
        if (to !== 'ARCHIVED') {
          expect(canTransition('LOST', to)).toBe(false);
        }
      });
    });

    it('ACTIVE cannot transition to anything other than ON_HOLD, REVIEW, or COMPLETED', () => {
      ALL_STATUSES.forEach((to) => {
        if (to !== 'ON_HOLD' && to !== 'REVIEW' && to !== 'COMPLETED') {
          expect(canTransition('ACTIVE', to)).toBe(false);
        }
      });
    });

    it('ON_HOLD cannot transition to anything other than ACTIVE', () => {
      ALL_STATUSES.forEach((to) => {
        if (to !== 'ACTIVE') {
          expect(canTransition('ON_HOLD', to)).toBe(false);
        }
      });
    });

    it('REVIEW cannot transition to anything other than ACTIVE or COMPLETED', () => {
      ALL_STATUSES.forEach((to) => {
        if (to !== 'ACTIVE' && to !== 'COMPLETED') {
          expect(canTransition('REVIEW', to)).toBe(false);
        }
      });
    });

    it('COMPLETED cannot transition to anything other than ARCHIVED', () => {
      ALL_STATUSES.forEach((to) => {
        if (to !== 'ARCHIVED') {
          expect(canTransition('COMPLETED', to)).toBe(false);
        }
      });
    });

    it('ARCHIVED cannot transition to any status', () => {
      ALL_STATUSES.forEach((to) => {
        expect(canTransition('ARCHIVED', to)).toBe(false);
      });
    });

    // ─── Self-transition always invalid ────────────────────────────

    test.each(ALL_STATUSES)('self-transition %s → %s is invalid', (status) => {
      expect(canTransition(status, status)).toBe(false);
    });
  });

  describe('requiresLostReason', () => {
    it('returns true for LOST', () => {
      expect(requiresLostReason('LOST')).toBe(true);
    });

    it('returns false for all non-LOST statuses', () => {
      ALL_STATUSES.filter((s) => s !== 'LOST').forEach((status) => {
        expect(requiresLostReason(status)).toBe(false);
      });
    });
  });
});
