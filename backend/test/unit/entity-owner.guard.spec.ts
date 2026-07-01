import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { TenantContextService } from '../../src/common/context/tenant-context.service';
import { EntityOwnerGuard } from '../../src/common/guards/entity-owner.guard';
import type { Reflector } from '@nestjs/core';

/**
 * Unit tests for EntityOwnerGuard.
 *
 * Phase 3, Task 3.3.
 */

function makeExecutionContext(opts: {
  user?: { role: UserRole; sub?: string } | null;
  resource?: { tenantId: string | null } | null;
}): ExecutionContext {
  const request: Record<string, unknown> = {};
  if (opts.user !== null) request.user = opts.user ?? { role: 'USER', sub: 'u1' };
  if (opts.resource !== null) {
    request.resource = opts.resource ?? { tenantId: 'tenant-A' };
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

describe('EntityOwnerGuard', () => {
  it('passes when platform role', () => {
    const ctx = makeExecutionContext({
      user: { role: UserRole.SUPER_ADMIN },
      resource: { tenantId: 'tenant-A' },
    });
    const tenantCtx = { tenantId: 'tenant-X' } as never;
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx as TenantContextService);
    expect(() => guard.canActivate(ctx)).not.toThrow();
  });

  it('throws Forbidden when no user', () => {
    const ctx = makeExecutionContext({ user: null, resource: { tenantId: 'tenant-A' } });
    const tenantCtx = { tenantId: 'tenant-X' } as never;
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx as TenantContextService);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws Forbidden on cross-tenant access', () => {
    const ctx = makeExecutionContext({
      user: { role: UserRole.USER, sub: 'u1' },
      resource: { tenantId: 'tenant-B' },
    });
    const tenantCtx = {
      get: () => ({ tenantId: 'tenant-A' }),
    } as unknown as TenantContextService;
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('passes when resource.tenantId matches tenant context', () => {
    const ctx = makeExecutionContext({
      user: { role: UserRole.USER, sub: 'u1' },
      resource: { tenantId: 'tenant-A' },
    });
    const tenantCtx = {
      get: () => ({ tenantId: 'tenant-A' }),
    } as unknown as TenantContextService;
    const guard = new EntityOwnerGuard(reflectorStub, tenantCtx);
    expect(guard.canActivate(ctx)).toBe(true);
  });
});