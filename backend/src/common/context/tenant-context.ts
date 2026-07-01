/**
 * TenantContext — request-scoped tenant context (the value in ALS).
 *
 * Phase 1, Task 1.4 (per `EAOS-api-contract.md` §6.3 + `EAOS-rbac-model.md` §10).
 *
 * Populated by `TenantContextMiddleware` after JWT auth, then read by
 * services via `TenantContextService`.
 */

import type { UserRole } from '@prisma/client';

export interface TenantContext {
  /** Resolved tenantId for this request. */
  tenantId: string;
  /** True if a platform role overrode their own tenant via header/query/body. */
  isCrossTenant: boolean;
  /** The actor's role. */
  actorRole: UserRole;
  /** The actor's userId (from JWT sub). */
  actorUserId: string;
}
