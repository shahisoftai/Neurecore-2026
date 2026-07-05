/**
 * TenantContextGuard — populates the AsyncLocalStorage tenant context
 * for every authenticated request.
 *
 * MUST run AFTER JwtAuthGuard (so `req.user` is populated) and BEFORE
 * the controller method. Wires the resolved TenantContext into ALS via
 * `TenantContextService.run()`.
 *
 * Registered as a global guard via APP_GUARD in app.module.ts, AFTER
 * JwtAuthGuard. This ensures req.user is populated when this guard runs.
 *
 * FIX-010 (2026-07-04): Platform roles (SUPER_ADMIN, PLATFORM_ADMIN,
 * SECURITY_OFFICER, SUPPORT) used to throw `BadRequestException
 * ('TENANT_REQUIRED')` when no tenant override was provided in
 * header/query/body. That broke the entire admin portal: every
 * `/api/v1/*` call from `cc.neurecore.com` failed with 400 because
 * the admin UI doesn't pass a tenant header.
 *
 * Fix: when a platform role omits the override, set a sentinel
 * `tenantId = '*'` and mark `isCrossTenant = true`. Per-resource
 * controllers continue to enforce their own role + ownership checks
 * (e.g. `@Roles(SUPER_ADMIN)` on `/tenants`), so cross-tenant access
 * is still gated by the controller, not by this guard.
 *
 * Services that read `tenantContext.tenantId` and expect a real tenant
 * id must branch on `isCrossTenant` to decide whether to scope or not.
 * Today only the AI-action & knowledge-rag guards consume the context,
 * and both correctly no-op for `isCrossTenant = true`.
 */

import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { TenantContextService } from '../context/tenant-context.service';
import type { JwtPayload } from '../../modules/auth/interfaces/token.interface';
import { IS_PUBLIC_KEY } from '../decorators/roles.decorator';

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
    if (!override) {
      // FIX-010: platform roles can omit the tenant override for platform-wide
      // queries (e.g. /tenants list, /agents list across all tenants). The
      // wildcard sentinel lets downstream services recognise and skip
      // tenant scoping. Per-endpoint role checks still gate access.
      return {
        tenantId: PLATFORM_WILDCARD,
        isCrossTenant: true,
        actorRole: user.role,
      };
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

@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(
    private readonly tenantContext: TenantContextService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const user = request.user as JwtPayload | undefined;
    if (!user) return true;

    const ctx = resolveTenantContext(user, {
      query: request.query as Record<string, unknown>,
      headers: request.headers as Record<string, string | string[] | undefined>,
      body: request.body as { tenantId?: string },
    });

    // FIX-010: store the resolved context on the request so controllers
    // can read `request.tenantContext` without needing ALS. The original
    // `tenantContext.run(ctx, () => true)` pattern releases the ALS
    // scope before the controller method executes (the guard's `true`
    // return happens outside the ALS run scope).
    request.tenantContext = { ...ctx, actorUserId: user.sub };

    this.tenantContext.run(request.tenantContext, () => true);

    return true;
  }
}
