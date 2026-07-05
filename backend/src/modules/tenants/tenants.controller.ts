import {
  Controller,
  ForbiddenException,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { TenantsService } from './tenants.service';
import {
  CreateTenantDto,
  UpdateTenantDto,
  ChangeTierDto,
} from './dto/tenant.dto';
import { UpdateMyTenantDto } from './dto/update-my-tenant.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { ActionResult } from '../../common/responses/action-result.response';
import type { TenantResponseDto } from './dto/tenant-response.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller({ path: 'tenants', version: '1' })
@ApiCommon('tenants')
@UseGuards(JwtAuthGuard, RolesGuard)
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Get()
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
  )
  async findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ): Promise<PaginatedResponse<TenantResponseDto>> {
    const { items, total } = await this.tenantsService.findAll(
      page,
      limit,
      search,
    );
    return {
      items: items as unknown as TenantResponseDto[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get(':id')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.SECURITY_OFFICER,
    UserRole.SUPPORT,
    UserRole.OWNER,
  )
  findOne(@Param('id') id: string, @CurrentUser() user: any) {
    if (
      user?.role === UserRole.OWNER &&
      user?.tenantId &&
      user.tenantId !== id
    ) {
      throw new ForbiddenException(
        'Tenant owners may only access their own tenant',
      );
    }
    return this.tenantsService.findOne(id);
  }

  @Get('me/current')
  @Roles(UserRole.OWNER, UserRole.ADMIN, UserRole.USER, UserRole.AUDITOR)
  async getCurrent(@CurrentUser() user: { tenantId?: string | null }) {
    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context for current user');
    }
    return this.tenantsService.findOne(user.tenantId);
  }

  /**
   * WS-2.1: Owner-scoped tenant update — restricted fields, no status / slug /
   * tier (those require platform admin endpoints). Used by Tier-1 wizard and
   * sub-wizards to persist tenant-level preferences.
   */
  @Patch('me')
  @Roles(UserRole.OWNER, UserRole.ADMIN)
  async updateMine(
    @CurrentUser() user: { tenantId?: string | null; sub: string },
    @Body() dto: UpdateMyTenantDto,
  ): Promise<unknown> {
    if (!user?.tenantId) {
      throw new ForbiddenException('No tenant context for current user');
    }
    return this.tenantsService.updateMine(user.tenantId, user.sub, dto);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Patch(':id/suspend')
  @Roles(UserRole.SUPER_ADMIN)
  async suspend(
    @Param('id') id: string,
  ): Promise<ActionResult<TenantResponseDto | null>> {
    const tenant = await this.tenantsService.suspend(id);
    return {
      success: true,
      message: 'Tenant suspended',
      data: tenant as unknown as TenantResponseDto | null,
    };
  }

  @Patch(':id/change-tier')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN)
  async changeTier(
    @Param('id') id: string,
    @Body() dto: ChangeTierDto,
  ): Promise<ActionResult<TenantResponseDto | null>> {
    const tenant = await this.tenantsService.changeTier(id, dto.tierId);
    return {
      success: true,
      message: 'Tier changed',
      data: tenant as unknown as TenantResponseDto | null,
    };
  }
}
