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
 * Phase 1E (Task 1.49): The standalone `resolveTenantContext` function
 * (formerly in `common/utils/resolve-tenant-context.ts`) has been inlined
 * here as a private helper. The standalone file is deleted — only the
 * service form (`TenantContextService`) is needed now.
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

// ─── Inlined tenant resolution (was resolve-tenant-context.ts) ───────────────

const PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);

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
    if (!override) {
      throw new BadRequestException({
        code: 'TENANT_REQUIRED',
        message: `${user.role} must specify tenantId via header, query, or body.`,
      });
    }
    return {
      tenantId: override,
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
