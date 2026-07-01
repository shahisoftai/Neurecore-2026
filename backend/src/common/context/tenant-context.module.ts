import { Module, Global } from '@nestjs/common';
import { TenantContextService } from './tenant-context.service';
import { TenantContextMiddleware } from './tenant-context.middleware';

/**
 * TenantContextModule — provides TenantContextService + middleware.
 *
 * @Global so every feature module can inject TenantContextService without
 * adding this to their `imports`. This is required by Phase 1E
 * (`EAOS-implementation-plan.md` §11.3) — every service that reads/
 * writes tenant-scoped entities uses `TenantContextService`.
 *
 * Module-only providers live here; nothing else in the codebase should
 * re-declare this service.
 */
@Global()
@Module({
  providers: [TenantContextService, TenantContextMiddleware],
  exports: [TenantContextService, TenantContextMiddleware],
})
export class TenantContextModule {}