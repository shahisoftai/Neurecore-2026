/**
 * DepartmentsPoolController — REST surface for /api/v1/departments-pool.
 *
 * Phase 10 — clean public surface for the Departments Pool.
 * Legacy /api/v1/department-templates still serves the old controllers.
 */

import { Controller, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PoolController } from '../../common/pool/pool.controller';
import type { DepartmentTemplate } from '@prisma/client';
import type { CreateDepartmentPoolDto } from './dto/create-department-pool.dto';
import type { UpdateDepartmentPoolDto } from './dto/update-department-pool.dto';
import { DepartmentsPoolService } from './departments-pool.service';

@ApiTags('departments-pool')
@ApiBearerAuth()
@Controller({ path: 'departments-pool', version: '1' })
@UseGuards(RolesGuard)
@Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
export class DepartmentsPoolController extends PoolController<
  DepartmentTemplate,
  CreateDepartmentPoolDto,
  UpdateDepartmentPoolDto
> {
  protected readonly service: DepartmentsPoolService;

  constructor(service: DepartmentsPoolService) {
    super();
    this.service = service;
  }
}
