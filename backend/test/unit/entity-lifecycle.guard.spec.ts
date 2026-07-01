import { ExecutionContext, ForbiddenException, BadRequestException } from '@nestjs/common';
import { EntityLifecycleGuard } from '../../src/common/guards/entity-lifecycle.guard';
import { UserRole } from '@prisma/client';

/**
 * Unit tests for EntityLifecycleGuard.
 *
 * Phase 3, Task 3.8.
 */

function makeCtx(opts: {
  user?: { role: UserRole; sub?: string } | null;
  body?: { from?: string; to?: string } | null;
}): ExecutionContext {
  const req: Record<string, unknown> = {};
  if (opts.user !== null) req.user = opts.user ?? { role: 'USER', sub: 'u1' };
  if (opts.body !== null) {
    req.body = opts.body ?? { from: 'DRAFT', to: 'PENDING_APPROVAL' };
  }
  return {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => ({}),
      getNext: () => () => undefined,
    }),
    getHandler: () => () => undefined,
    getClass: () => class {},
  } as unknown as ExecutionContext;
}

describe('EntityLifecycleGuard', () => {
  const guard = new EntityLifecycleGuard();

  it('throws when no user', () => {
    const ctx = makeCtx({ user: null });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('throws when body missing target state', () => {
    const ctx = makeCtx({ body: {} });
    expect(() => guard.canActivate(ctx)).toThrow(BadRequestException);
  });

  it('allows platform role on any transition', () => {
    const ctx = makeCtx({
      user: { role: UserRole.SUPER_ADMIN },
      body: { from: 'DRAFT', to: 'ACTIVE' },
    });
    expect(() => guard.canActivate(ctx)).not.toThrow();
  });

  it('rejects DELETED for non-OWNER', () => {
    const ctx = makeCtx({
      user: { role: UserRole.ADMIN },
      body: { from: 'ACTIVE', to: 'DELETED' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows OWNER to DELETED', () => {
    const ctx = makeCtx({
      user: { role: UserRole.OWNER },
      body: { from: 'ACTIVE', to: 'DELETED' },
    });
    expect(() => guard.canActivate(ctx)).not.toThrow();
  });

  it('rejects USER attempting DRAFT->PENDING_APPROVAL if not owner', () => {
    const ctx = makeCtx({
      user: { role: UserRole.USER, sub: 'u-other' },
      body: { from: 'DRAFT', to: 'PENDING_APPROVAL' },
    });
    // Set resource.ownerId != user.sub via req.resource
    (ctx.switchToHttp().getRequest() as { resource?: { ownerId: string } }).resource = {
      ownerId: 'u-not-this-user',
    };
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('allows USER who is the owner to submit', () => {
    const ctx = makeCtx({
      user: { role: UserRole.USER, sub: 'u1' },
      body: { from: 'DRAFT', to: 'PENDING_APPROVAL' },
    });
    (ctx.switchToHttp().getRequest() as { resource?: { ownerId: string } }).resource = {
      ownerId: 'u1',
    };
    expect(() => guard.canActivate(ctx)).not.toThrow();
  });
});