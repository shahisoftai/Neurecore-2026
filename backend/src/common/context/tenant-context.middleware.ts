/**
 * TenantContextMiddleware — populates the AsyncLocalStorage tenant context
 * for every authenticated request.
 *
 * Phase 1, Task 1.4 (per `EAOS-api-contract.md` §6.3 + `EAOS-rbac-model.md` §10).
 *
 * MUST run AFTER the JWT guard (so `req.user` is populated) and BEFORE
 * the controller method. Wires the resolved TenantContext into ALS via
 * `TenantContextService.run(ctx, next)`.
 *
 * Wired in `AppModule.configure(consumer)` as:
 *   consumer.apply(JwtAuthGuard, RolesGuard, TenantContextMiddleware)
 *          .forRoutes('*');
 *
 * The middleware is a no-op for routes that don't have an authenticated
 * user (e.g. @Public() routes) — it just calls next() and returns. The
 * TenantContextService.get() will throw if a service later tries to read
 * the context, which is the correct behavior.
 *
 * FIX-010 (2026-07-04): the platform-role path used to throw 400
 * ('TENANT_REQUIRED') when no override was supplied. Mirrored the guard
 * fix here for consistency: platform roles with no override now resolve
 * to the `*` wildcard sentinel.
 */

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NestMiddleware,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { UserRole } from '@prisma/client';
import { TenantContextService } from './tenant-context.service';
import type { JwtPayload } from '../../modules/auth/interfaces/token.interface';

const PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);

/** Sentinel tenantId for platform-level (cross-tenant) requests. */
export const PLATFORM_WILDCARD = '*';

interface TenantContextInput {
  query?: Record<string, unknown>;
  headers?: Record<string, string | string[] | undefined>;
  body?: { tenantId?: string };
}

interface ResolvedTenantContext {
  tenantId: string;
  isCrossTenant: boolean;
  actorRole: UserRole;
}

function isPlatformRole(role: UserRole): boolean {
  return PLATFORM_ROLES.has(role);
}

function extractOverride(input: TenantContextInput | undefined): string | undefined {
  if (!input) return undefined;
  const fromBody = input.body?.tenantId;
  if (typeof fromBody === 'string' && fromBody.length > 0) return fromBody;
  const fromQuery = input.query?.tenantId;
  if (typeof fromQuery === 'string' && fromQuery.length > 0) return fromQuery;
  const fromHeader = input.headers?.['x-tenant-id'];
  if (typeof fromHeader === 'string' && fromHeader.length > 0) return fromHeader;
  if (Array.isArray(fromHeader) && fromHeader[0]) return fromHeader[0];
  return undefined;
}

function resolveTenantContext(
  user: JwtPayload,
  input?: TenantContextInput,
): ResolvedTenantContext {
  if (!user) {
    throw new ForbiddenException({
      code: 'NO_AUTHENTICATED_USER',
      message: 'Authentication required.',
    });
  }

  if (isPlatformRole(user.role)) {
    const override = extractOverride(input);
    // FIX-010: allow platform roles to omit the override; the wildcard
    // sentinel lets downstream services recognise a cross-tenant query.
    return {
      tenantId: override ?? PLATFORM_WILDCARD,
      isCrossTenant: true,
      actorRole: user.role,
    };
  }

  if (!user.tenantId) {
    throw new ForbiddenException({
      code: 'TENANT_CONTEXT_MISSING',
      message: 'User has no tenant context.',
    });
  }
  return {
    tenantId: user.tenantId,
    isCrossTenant: false,
    actorRole: user.role,
  };
}

// ─── Middleware ───────────────────────────────────────────────────────────────

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(private readonly tenantContext: TenantContextService) {}

  use(req: Request, _res: Response, next: NextFunction): void {
    const user = req.user as JwtPayload | undefined;
    if (!user) {
      next();
      return;
    }

    let ctx: ResolvedTenantContext;
    try {
      ctx = resolveTenantContext(user, {
        query: req.query as Record<string, unknown>,
        headers: req.headers as Record<string, string | string[] | undefined>,
        body: req.body as { tenantId?: string },
      });
    } catch {
      next();
      return;
    }

    this.tenantContext.run(
      { ...ctx, actorUserId: user.sub },
      () => next(),
    );
  }
}
