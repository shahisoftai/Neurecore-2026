/**
 * ═══════════════════════════════════════════════════════════════════════════
 * assert-same-tenant.ts — Single canonical cross-tenant denial helper
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Phase 0 (FIX-007, EAOS-rbac-model.md §5): Use this after loading an entity
 * to verify it belongs to the caller's tenant. Platform roles bypass.
 *
 * Replaces the implicit-by-convention pattern where 100+ service methods
 * pass `tenantId` as a parameter and use it in their Prisma `where` clause.
 * If a future service method forgets the `tenantId` arg, it's a security
 * incident. This helper is the explicit, single chokepoint.
 *
 * Usage:
 *   const agent = await this.prisma.agent.findUnique({ where: { id } });
 *   if (!agent) throw new NotFoundException();
 *   assertSameTenant(user, agent.tenantId);
 *
 * For Phase 0: apply to critical findOne endpoints (agents, departments).
 * For Phase 3: replace all 100+ manual `where: { tenantId }` filters with the
 * full EntityOwnerGuard + TenantContextService + AsyncLocalStorage.
 */

import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { JwtPayload } from '../../modules/auth/interfaces/token.interface';

const PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);

function isPlatformRole(role: UserRole): boolean {
  return PLATFORM_ROLES.has(role);
}

/**
 * Throws ForbiddenException with code CROSS_TENANT_ACCESS if the resource
 * is not in the caller's tenant. Platform roles bypass.
 *
 * @param user The authenticated user (from JWT).
 * @param resourceTenantId The tenantId of the resource being accessed.
 * @param options.resourceType Optional: for error messages (e.g. 'agent').
 * @param options.resourceId Optional: for error messages.
 */
export function assertSameTenant(
  user: JwtPayload,
  resourceTenantId: string | null | undefined,
  options?: { resourceType?: string; resourceId?: string },
): void {
  if (isPlatformRole(user.role)) return;

  if (!user.tenantId) {
    throw new ForbiddenException({
      code: 'TENANT_CONTEXT_MISSING',
      message: 'User has no tenant context.',
    });
  }

  if (!resourceTenantId || resourceTenantId !== user.tenantId) {
    const what = options?.resourceType ?? 'resource';
    const id = options?.resourceId ? ` (id=${options.resourceId})` : '';
    throw new ForbiddenException({
      code: 'CROSS_TENANT_ACCESS',
      message: `Cross-tenant ${what} access denied${id}.`,
    });
  }
}
