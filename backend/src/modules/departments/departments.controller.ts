import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { DepartmentsService } from './services/departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { TierLimit } from '../../common/decorators/tier-limit.decorator';
import { TierLimitsGuard } from '../../common/guards/tier-limits.guard';
import { assertSameTenant } from '../../common/utils/assert-same-tenant';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { ApiOkResponse } from '@nestjs/swagger';
import { DepartmentResponseDto } from './dto/department-response.dto';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

@Controller({ path: 'departments', version: '1' })
@ApiCommon('departments')
@UseGuards(TierLimitsGuard)
export class DepartmentsController {
  constructor(
    private readonly departmentsService: DepartmentsService,
  ) {}

  @Get()
  @ApiOkResponse({ type: PaginatedResponse<DepartmentResponseDto> })
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponse<DepartmentResponseDto>> {
    if (!user.tenantId) {
      throw new Error('Tenant ID is required to list departments');
    }
    const all = await this.departmentsService.findAll(user.tenantId);
    const start = (pagination.page - 1) * pagination.limit;
    const items = all.slice(start, start + pagination.limit);
    return {
      items: items as unknown as DepartmentResponseDto[],
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total: all.length,
        totalPages: Math.max(1, Math.ceil(all.length / pagination.limit)),
      },
    };
  }

  @Get(':id')
  @TenantIsolated()
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new Error('Tenant ID is required to get a department');
    }
    const dept = await this.departmentsService.findOne(id, user.tenantId);
    assertSameTenant(user, (dept as { tenantId?: string | null })?.tenantId, {
      resourceType: 'department',
      resourceId: id,
    });
    return dept;
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @TierLimit('maxDepartments')
  create(@CurrentUser() user: JwtPayload, @Body() dto: CreateDepartmentDto) {
    if (!user.tenantId) {
      throw new Error('Tenant ID is required to create a department');
    }
    return this.departmentsService.create(dto, user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: UpdateDepartmentDto,
  ) {
    if (!user.tenantId) {
      throw new Error('Tenant ID is required to update a department');
    }
    return this.departmentsService.update(id, dto, user.tenantId);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) {
      throw new Error('Tenant ID is required to delete a department');
    }
    return this.departmentsService.remove(id, user.tenantId);
  }
}
