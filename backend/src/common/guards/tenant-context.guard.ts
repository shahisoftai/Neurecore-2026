/**
 * TenantContextGuard — populates the AsyncLocalStorage tenant context
 * for every authenticated request.
 *
 * MUST run AFTER JwtAuthGuard (so `req.user` is populated) and BEFORE
 * the controller method. Wires the resolved TenantContext into ALS via
 * `TenantContextService.run()`.
 *
 * Registered as a global guard via APP_GUARD in app.module.ts, AFTER
 * JwtAuthGuard (line 181). This ensures req.user is populated when
 * this guard runs.
 *
 * The TenantContextMiddleware (applied as global middleware) is now
 * a no-op that just calls next() - it cannot run after JwtAuthGuard
 * because NestJS middleware always runs before guards. The guard pattern
 * is the correct approach.
 */

import {
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
    return {
      tenantId: override ?? '',
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

    this.tenantContext.run({ ...ctx, actorUserId: user.sub }, () => true);

    return true;
  }
}
