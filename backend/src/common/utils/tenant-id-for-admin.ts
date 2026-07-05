import type { JwtPayload } from '../../modules/auth/interfaces/token.interface';

/**
 * Resolves the effective tenantId for controller handlers that need to
 * support platform-role callers (SUPER_ADMIN, PLATFORM_ADMIN, etc.) who
 * don't carry a JWT tenantId.
 *
 * Uses the TenantContextGuard-set wildcard '*', falls back to JWT tenantId.
 * Returns the wildcard for cross-tenant platform queries; throws for
 * non-platform users missing tenant context.
 */
export function resolveTenantId(
  tenantContext: { getOrNull(): { tenantId?: string } | null } | null,
  user: JwtPayload,
): string {
  const ctx = tenantContext?.getOrNull();
  const raw = ctx?.tenantId ?? user.tenantId;
  if (!raw) {
    throw new Error('Tenant ID required');
  }
  return raw;
}
