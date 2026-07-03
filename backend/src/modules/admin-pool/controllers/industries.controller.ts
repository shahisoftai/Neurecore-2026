/**
 * IndustriesController — exposes the `Industry` enum as a typed list.
 *
 * SOLID: SRP — read-only. No write paths; the enum is owned by the migration.
 *
 * Routes (path: 'admin/industries', version '1'):
 *   GET /            — full enum as [{ value, label }] for FE `<select>`.
 *
 * Auth: JwtAuthGuard + RolesGuard are global (per app.module.ts). Writes are
 * blocked by virtue of the enum not being mutable; reads are public-equivalent
 * (frontend wizard pre-fill). Marked @Public to skip JWT only after the global
 * guard order is documented — left @Roles(SUPER_ADMIN, PLATFORM_ADMIN,
 * SECURITY_OFFICER, SUPPORT, OWNER, ADMIN, USER, AUDITOR) to mirror the
 * other catalog controllers in the codebase.
 */

import { Controller, Get } from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { INDUSTRY_LABELS } from '../interfaces/admin-pool.interface';

@ApiCommon('admin-industries')
@Controller({ path: 'admin/industries', version: '1' })
export class IndustriesController {
  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  list(): ReadonlyArray<{ value: string; label: string }> {
    return INDUSTRY_LABELS.map((i) => ({ value: i.value, label: i.label }));
  }
}
