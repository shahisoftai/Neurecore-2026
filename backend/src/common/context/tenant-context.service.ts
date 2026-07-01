/**
 * TenantContextService — request-scoped tenant context, AsyncLocalStorage-backed.
 *
 * Phase 1, Task 1.4 (per `EAOS-api-contract.md` §6.3 + `EAOS-rbac-model.md` §10).
 *
 * Usage from a service:
 *   constructor(private readonly tenantContext: TenantContextService) {}
 *   findAll() { return this.prisma.foo.findMany({ where: { tenantId: this.tenantContext.tenantId } }); }
 *
 * Set the context at the start of a request via `TenantContextMiddleware.run()`.
 * The middleware binds the ALS store for the lifetime of the request.
 */

import { Injectable, Global } from '@nestjs/common';
import { AsyncLocalStorage } from 'node:async_hooks';
import type { TenantContext } from './tenant-context';

/**
 * @Global so every module can inject TenantContextService without
 * re-importing CommonContextModule. This is required by Phase 1E
 * (per `EAOS-implementation-plan.md` §11.3) — every service that
 * reads/writes tenant-scoped entities uses `TenantContextService`.
 */
@Global()
@Injectable()
export class TenantContextService {
  private readonly als = new AsyncLocalStorage<TenantContext>();

  /**
   * Run `fn` with `ctx` bound to the ALS store. The store is available
   * to any code called from within `fn`, including nested async calls,
   * setTimeout, setImmediate, and Promise chains.
   */
  run<T>(ctx: TenantContext, fn: () => T): T {
    return this.als.run(ctx, fn);
  }

  /**
   * Read the current context. Throws if called outside a `run()` scope.
   * Throwing (rather than returning a default) is intentional: a service
   * that reads `tenantContext.tenantId` outside a request scope has a bug.
   */
  get(): TenantContext {
    const ctx = this.als.getStore();
    if (!ctx) {
      throw new Error(
        'TenantContext accessed outside a request scope. ' +
          'Ensure the call is inside a route handler or background job that ran via TenantContextService.run().',
      );
    }
    return ctx;
  }

  /**
   * Convenience: read just the tenantId.
   * Throws if the context is not bound.
   */
  get tenantId(): string {
    return this.get().tenantId;
  }

  /**
   * Returns the context if available, or null if outside a request scope.
   * Use this for code paths that may run outside an HTTP request
   * (e.g. background jobs, cron, system-triggered events).
   */
  getOrNull(): TenantContext | null {
    return this.als.getStore() ?? null;
  }
}
