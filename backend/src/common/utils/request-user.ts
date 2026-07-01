/**
 * ═══════════════════════════════════════════════════════════════════════════
 * request-user.ts — Typed accessor for `req.user` on Express/Fastify requests
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Phase 10 cleanup (`EAOS-implementation-roadmap.md` §14 task 10.11):
 * Replaces the `(request as any).user` defensive cast that was duplicated
 * across `AuditInterceptor`, the exception filter, the security controller,
 * and the LangGraph checkpoint service.
 *
 * The pattern was over-defensive: NestJS always sets `req.user` after a
 * JwtAuthGuard run. The shape is `ValidatedUser | undefined` (undefined for
 * `@Public()` routes). Using `request.user` directly through this helper
 * preserves the type so downstream code can access fields without `?.` chains
 * being optional.
 *
 * Usage:
 *   import { getRequestUser } from '../../../common/utils/request-user';
 *   const user = getRequestUser(request);
 *   if (!user) return;  // public route — no audit actor
 *
 * SOLID: SRP — one concern: safely extract the validated user from a request.
 */

import type { Request } from 'express';
import type { ValidatedUser } from '../../modules/auth/interfaces/auth.interface';

/**
 * A loose user shape that matches what `JwtStrategy.validate` returns. We
 * don't import the interface here to avoid a circular dep; structural typing
 * suffices because `ValidatedUser` only has these fields plus a few more.
 */
export interface RequestUser {
  id: string;
  sub?: string;
  email?: string;
  tenantId?: string | null;
  role?: string;
}

/**
 * Read the validated user from an Express request, or `undefined` on a
 * `@Public()` route where JwtAuthGuard didn't run.
 *
 * Returns `undefined` rather than throwing because some endpoints (the
 * public health/metrics/docs routes) intentionally have no user.
 */
export function getRequestUser(
  request: Request | { user?: unknown },
): RequestUser | undefined {
  const user = (request as { user?: unknown }).user;
  if (!user || typeof user !== 'object') return undefined;
  return user as RequestUser;
}

/**
 * Convenience: returns the actor id (user id or sub claim) or 'anonymous'
 * if no user is attached.
 */
export function getRequestActorId(request: Request): string {
  const user = getRequestUser(request);
  return user?.id ?? user?.sub ?? 'anonymous';
}

/**
 * Re-export `ValidatedUser` for callers that want the full type.
 */
export type { ValidatedUser };