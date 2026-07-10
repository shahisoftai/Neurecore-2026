import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TenantContextService } from '../../src/common/context/tenant-context.service';
import { EntityOwnerGuard } from '../../src/common/guards/entity-owner.guard';
import type { Reflector } from '@nestjs/core';

/**
 * Unit tests for EntityOwnerGuard.
 *
 * The guard validates that the authenticated user has a valid tenant context.
 * Cross-tenant access is prevented at the service layer (Prisma queries are
 * filtered by tenantId from req.user.tenantId).
 *
 * Note: The guard no longer compares resource.tenantId against user.tenantId
 * because guards run BEFORE route handlers, so req.resource cannot be set
 * before the guard executes. See the comment in entity-owner.guard.ts.
 */

function makeExecutionContext(opts: {
  user?: { role: UserRole; sub?: string; tenantId?: string | null } | null;
}): ExecutionContext {
  const request: Record<string, unknown> = {};
  if (opts.user !== null) {
    request.user = opts.user ?? { role: 'USER', sub: 'u1', tenantId: 'tenant-A' };
  }
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => ({}),
      getNext: () => () => undefined,
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

const reflectorStub = {
  getAllAndOverride: () => false,
} as unknown as Reflector;

const tenantCtx = {} as TenantContextService;

describe('EntityOwnerGuard', () => {
  it('passes when platform role (SUPER_ADMIN)', () => {
    const ctx = makeExecutionContext({
      user: { role: UserRole.SUPER_ADMIN },
    });
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('throws Forbidden when no user', () => {
    const ctx = makeExecutionContext({ user: null });
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws Forbidden when non-platform user has no tenantId', () => {
    const ctx = makeExecutionContext({
      user: { role: UserRole.USER, sub: 'u1', tenantId: null },
    });
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('passes when user has valid tenantId', () => {
    const ctx = makeExecutionContext({
      user: { role: UserRole.USER, sub: 'u1', tenantId: 'tenant-A' },
    });
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('passes for PLATFORM_ADMIN role', () => {
    const ctx = makeExecutionContext({
      user: { role: UserRole.PLATFORM_ADMIN },
    });
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});
