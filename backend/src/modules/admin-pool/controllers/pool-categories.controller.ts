/**
 * PoolCategoriesController — admin CRUD for PoolDepartment rows (the
 * platform "divisions" that group PoolAgents and IndustryPackageEntries).
 *
 * Paths (under /api/v1/admin/pool):
 *   GET    /departments     list
 *   GET    /departments/:id one
 *   PATCH  /departments/:id partial update (name/icon/color/description/sortOrder/isActive)
 *
 * Auth: global JwtAuthGuard + RolesGuard. Writes are restricted to
 * SUPER_ADMIN and PLATFORM_ADMIN. Reads are available to admin-tier
 * roles that operate the FA `/pool` and `/pool/packages` pages.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { PoolCatalogService } from '../services/pool-catalog.service';
import { UpdatePoolDepartmentDto } from '../dto/admin-pool.dto';
import type { PoolDepartmentDto } from '../interfaces/admin-pool.interface';

@ApiCommon('admin-pool-departments')
@Controller({ path: 'admin/pool/departments', version: '1' })
export class PoolCategoriesController {
  constructor(private readonly catalog: PoolCatalogService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  list(): Promise<PoolDepartmentDto[]> {
    return this.catalog.listDepartments();
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  getOne(@Param('id', ParseUUIDPipe) id: string): Promise<PoolDepartmentDto> {
    return this.catalog.getDepartment(id);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePoolDepartmentDto,
  ): Promise<PoolDepartmentDto> {
    return this.catalog.updateDepartment(id, dto);
  }
}
