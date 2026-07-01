/**
 * tenantIsolated — convenience decorator bundle for resource-scoped GET routes.
 *
 * Phase 3, Task 3.4.
 *
 * The existing controllers use `assertSameTenant(...)` inline (a runtime
 * tenant check). EntityOwnerGuard is the new pattern (Phase 3 rbac §5).
 * This decorator wraps both: it applies EntityOwnerGuard as a route guard
 * while the inline `assertSameTenant` still runs. The guard is a no-op
 * when no `req.resource` is present (it just passes), so existing
 * controllers that load the resource inline continue to work — the
 * guard is wired so that future migrations to the `req.resource` pattern
 * are a one-line change.
 *
 * Usage:
 *   @Get(':id')
 *   @TenantIsolated()
 *   async findOne(@Param('id') id: string) { ... }
 */

import { applyDecorators, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { EntityOwnerGuard } from './entity-owner.guard';

export function TenantIsolated() {
  return applyDecorators(UseGuards(JwtAuthGuard, RolesGuard, EntityOwnerGuard));
}