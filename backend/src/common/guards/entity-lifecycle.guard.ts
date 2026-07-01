/**
 * EntityLifecycleGuard — enforces per-transition permissions on the
 * universal entity state machine.
 *
 * Phase 3, Task 3.8 (per `EAOS-rbac-model.md` §4.2 + `EAOS-implementation-plan.md` §1.3).
 *
 * Per-transition permissions (canonical):
 *   DRAFT          -> PENDING_APPROVAL : OWNER, ADMIN, USER (owner can submit)
 *   PENDING_APPROVAL -> ACTIVE         : OWNER, ADMIN (or assigned approver)
 *   ACTIVE         -> PAUSED          : OWNER, ADMIN
 *   ACTIVE         -> SUSPENDED       : OWNER, ADMIN (or system)
 *   ANY            -> ARCHIVED        : OWNER, ADMIN
 *   ARCHIVED       -> DRAFT           : OWNER, ADMIN (restore)
 *   ANY            -> DELETED         : OWNER ONLY (destructive)
 *
 * Usage:
 *   @Post(':id/lifecycle/transition')
 *   @UseGuards(JwtAuthGuard, RolesGuard, EntityLifecycleGuard)
 *   async transition(@Body() dto: LifecycleTransitionDto) {
 *     // Body carries `to: UniversalStateValue` — guard reads it.
 *   }
 */

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';

type UniversalStateValue =
  | 'DRAFT'
  | 'PENDING_APPROVAL'
  | 'ACTIVE'
  | 'PAUSED'
  | 'SUSPENDED'
  | 'ARCHIVED'
  | 'DELETED';

// Allowed transitions per EAOS-rbac-model.md §4.2
const TRANSITION_ROLES: ReadonlyMap<string, ReadonlySet<UserRole>> = new Map([
  ['DRAFT->PENDING_APPROVAL', new Set([UserRole.OWNER, UserRole.ADMIN, UserRole.USER])],
  ['PENDING_APPROVAL->ACTIVE', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['PENDING_APPROVAL->DRAFT', new Set([UserRole.OWNER, UserRole.ADMIN])], // reject
  ['ACTIVE->PAUSED', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['PAUSED->ACTIVE', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['ACTIVE->SUSPENDED', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['SUSPENDED->ACTIVE', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['ACTIVE->ARCHIVED', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['SUSPENDED->ARCHIVED', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['PAUSED->ARCHIVED', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['DRAFT->ARCHIVED', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['PENDING_APPROVAL->ARCHIVED', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['ARCHIVED->DRAFT', new Set([UserRole.OWNER, UserRole.ADMIN])], // restore
  ['ARCHIVED->ACTIVE', new Set([UserRole.OWNER, UserRole.ADMIN])],
  ['ANY->DELETED', new Set([UserRole.OWNER])], // destructive — OWNER only
]);

function isPlatformRole(role: UserRole): boolean {
  return (
    role === UserRole.SUPER_ADMIN ||
    role === UserRole.PLATFORM_ADMIN ||
    role === UserRole.SECURITY_OFFICER ||
    role === UserRole.SUPPORT
  );
}

@Injectable()
export class EntityLifecycleGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx
      .switchToHttp()
      .getRequest<{
        user?: { role: UserRole; sub?: string };
        body?: { from?: UniversalStateValue; to?: UniversalStateValue };
        resource?: { ownerId?: string | null; tenantId?: string | null } | null;
      }>();

    if (!req.user) {
      throw new ForbiddenException({
        code: 'NO_AUTHENTICATED_USER',
        message: 'Authentication required.',
      });
    }

    // Platform roles always pass.
    if (isPlatformRole(req.user.role)) return true;

    const body = req.body ?? {};
    const from = body.from;
    const to = body.to;
    if (!to) {
      throw new BadRequestException({
        code: 'LIFECYCLE_TRANSITION_INVALID',
        message: 'Body must include "to" (target state).',
      });
    }

    // Validate the target state is a known state.
    const validStates: UniversalStateValue[] = [
      'DRAFT',
      'PENDING_APPROVAL',
      'ACTIVE',
      'PAUSED',
      'SUSPENDED',
      'ARCHIVED',
      'DELETED',
    ];
    if (!validStates.includes(to)) {
      throw new BadRequestException({
        code: 'LIFECYCLE_STATE_UNKNOWN',
        message: `Unknown target state: ${to}`,
      });
    }

    // 1. ANY -> DELETED is restricted to OWNER.
    if (to === 'DELETED') {
      if (req.user.role !== UserRole.OWNER) {
        throw new ForbiddenException({
          code: 'LIFECYCLE_DELETE_FORBIDDEN',
          message: 'Only OWNER may permanently delete entities.',
        });
      }
      return true;
    }

    // 2. Look up the role set for this transition.
    const fromKey = from ?? 'ANY';
    const key = `${fromKey}->${to}`;
    let allowed = TRANSITION_ROLES.get(key);
    if (!allowed && fromKey !== 'ANY') {
      // Try the wildcard fallback for the target state.
      allowed = TRANSITION_ROLES.get(`ANY->${to}`);
    }

    if (!allowed) {
      throw new ForbiddenException({
        code: 'LIFECYCLE_TRANSITION_NOT_ALLOWED',
        message: `Transition ${key} is not allowed by the state machine.`,
      });
    }

    if (!allowed.has(req.user.role)) {
      throw new ForbiddenException({
        code: 'LIFECYCLE_ROLE_FORBIDDEN',
        message: `Role ${req.user.role} may not perform ${key}.`,
      });
    }

    // 3. DRAFT -> PENDING_APPROVAL: only owner or OWNER/ADMIN may submit.
    if (from === 'DRAFT' && to === 'PENDING_APPROVAL') {
      const resource = req.resource;
      if (
        resource?.ownerId &&
        resource.ownerId !== req.user.sub &&
        req.user.role !== UserRole.OWNER &&
        req.user.role !== UserRole.ADMIN
      ) {
        throw new ForbiddenException({
          code: 'LIFECYCLE_NOT_OWNER',
          message: 'Only the entity owner (or OWNER/ADMIN) may submit for approval.',
        });
      }
    }

    return true;
  }
}
