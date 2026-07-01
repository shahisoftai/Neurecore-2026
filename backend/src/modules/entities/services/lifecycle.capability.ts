/**
 * LifecycleCapability — Phase 3 capability surface for the Lifecycle panel.
 *
 * First-class CORE panel (EAOS-implementation-plan.md §1.3 + §1.5 Lifecycle).
 * Returns: currentState, subState, availableTransitions, transitionRules,
 * stateHistory, autoTransitions, whyNotActive.
 *
 * This service also performs transitions (POST /lifecycle/transition) — the
 * controller delegates here. EntityLifecycleGuard validates the role/transition
 * pair at the boundary; this service records the change atomically.
 */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EntityResolverService } from './entity-resolver.service';
import type { EaosEntityType } from '../dto/entity.dto';
import { UniversalStateValue } from '@prisma/client';

export interface LifecycleTransitionRule {
  to: UniversalStateValue;
  label: string;
  allowedRoles: string[];
}

export interface LifecyclePanel {
  id: string;
  type: string;
  currentState: UniversalStateValue;
  subState: string | null;
  enteredAt: string;
  enteredBy: string | null;
  availableTransitions: LifecycleTransitionRule[];
  transitionRules: LifecycleTransitionRule[];
  stateHistory: Array<{
    fromState: UniversalStateValue;
    toState: UniversalStateValue;
    transitionedAt: string;
    transitionedBy: string | null;
    reason: string | null;
    isAuto: boolean;
  }>;
  whyNotActive: string | null;
}

const VALID_TRANSITIONS: ReadonlyArray<[UniversalStateValue, UniversalStateValue]> = [
  ['DRAFT', 'PENDING_APPROVAL'],
  ['DRAFT', 'ARCHIVED'],
  ['PENDING_APPROVAL', 'ACTIVE'],
  ['PENDING_APPROVAL', 'DRAFT'],
  ['PENDING_APPROVAL', 'ARCHIVED'],
  ['ACTIVE', 'PAUSED'],
  ['ACTIVE', 'SUSPENDED'],
  ['ACTIVE', 'ARCHIVED'],
  ['PAUSED', 'ACTIVE'],
  ['PAUSED', 'ARCHIVED'],
  ['SUSPENDED', 'ACTIVE'],
  ['SUSPENDED', 'ARCHIVED'],
  ['ARCHIVED', 'DRAFT'],
  ['ARCHIVED', 'ACTIVE'],
];

function transitionLabel(to: UniversalStateValue): string {
  switch (to) {
    case 'DRAFT':
      return 'Move to Draft';
    case 'PENDING_APPROVAL':
      return 'Submit for Approval';
    case 'ACTIVE':
      return 'Activate';
    case 'PAUSED':
      return 'Pause';
    case 'SUSPENDED':
      return 'Suspend';
    case 'ARCHIVED':
      return 'Archive';
    case 'DELETED':
      return 'Delete';
    default:
      return to;
  }
}

function defaultRolesFor(from: UniversalStateValue, to: UniversalStateValue): string[] {
  if (to === 'DELETED') return ['OWNER'];
  if (from === 'DRAFT' && to === 'PENDING_APPROVAL') {
    return ['OWNER', 'ADMIN', 'USER'];
  }
  if (to === 'PENDING_APPROVAL' || to === 'ACTIVE' || to === 'PAUSED' ||
      to === 'SUSPENDED' || to === 'ARCHIVED' || to === 'DRAFT') {
    return ['OWNER', 'ADMIN'];
  }
  return ['OWNER', 'ADMIN'];
}

@Injectable()
export class LifecycleCapability {
  constructor(
    private readonly prisma: PrismaService,
    private readonly resolver: EntityResolverService,
  ) {}

  async get(
    type: EaosEntityType,
    id: string,
    tenantId: string,
  ): Promise<LifecyclePanel> {
    const entity = await this.resolver.resolve(type, id, tenantId);

    const [state, history] = await Promise.all([
      this.prisma.entityState.findUnique({
        where: {
          tenantId_entityType_entityId: { tenantId, entityType: type, entityId: id },
        },
      }),
      this.prisma.stateHistory.findMany({
        where: { tenantId, entityType: type, entityId: id },
        orderBy: { transitionedAt: 'desc' },
        take: 100,
      }),
    ]);

    const currentState = state?.currentState ?? 'DRAFT';
    const availableTransitions: LifecycleTransitionRule[] = VALID_TRANSITIONS
      .filter(([from]) => from === currentState)
      .map(([, to]) => ({
        to,
        label: transitionLabel(to),
        allowedRoles: defaultRolesFor(currentState, to),
      }));

    return {
      id: entity.id,
      type: entity.type,
      currentState,
      subState: state?.subState ?? null,
      enteredAt: (state?.enteredAt ?? entity.createdAt).toISOString(),
      enteredBy: state?.enteredById ?? null,
      availableTransitions,
      transitionRules: VALID_TRANSITIONS.map(([, to]) => ({
        to,
        label: transitionLabel(to),
        allowedRoles: defaultRolesFor(currentState, to),
      })),
      stateHistory: history.map((h) => ({
        fromState: h.fromState,
        toState: h.toState,
        transitionedAt: h.transitionedAt.toISOString(),
        transitionedBy: h.transitionedById,
        reason: h.reason,
        isAuto: h.isAuto,
      })),
      whyNotActive:
        currentState === 'ACTIVE'
          ? null
          : `Currently ${currentState}. Use the available transition to move to ACTIVE.`,
    };
  }

  async transition(
    type: EaosEntityType,
    id: string,
    tenantId: string,
    actorId: string,
    to: UniversalStateValue,
    reason: string | undefined,
  ): Promise<LifecyclePanel> {
    const entity = await this.resolver.resolve(type, id, tenantId);

    const current = await this.prisma.entityState.findUnique({
      where: {
        tenantId_entityType_entityId: { tenantId, entityType: type, entityId: id },
      },
    });

    const fromState = current?.currentState ?? 'DRAFT';
    const allowed = VALID_TRANSITIONS.some(([f, t]) => f === fromState && t === to);
    if (!allowed) {
      throw new BadRequestException({
        code: 'LIFECYCLE_TRANSITION_INVALID',
        message: `Cannot transition from ${fromState} to ${to}.`,
      });
    }

    const now = new Date();

    const upserted = await this.prisma.entityState.upsert({
      where: {
        tenantId_entityType_entityId: { tenantId, entityType: type, entityId: id },
      },
      update: {
        currentState: to,
        enteredAt: now,
        enteredById: actorId,
      },
      create: {
        tenantId,
        entityType: type,
        entityId: id,
        currentState: to,
        enteredAt: now,
        enteredById: actorId,
      },
    });

    await this.prisma.stateHistory.create({
      data: {
        tenantId,
        entityType: type,
        entityId: id,
        fromState,
        toState: to,
        transitionedAt: now,
        transitionedById: actorId,
        reason: reason ?? null,
        isAuto: false,
        entityStateId: upserted.id,
      },
    });

    return this.get(type, id, tenantId);
  }
}
