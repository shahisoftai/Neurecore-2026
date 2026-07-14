/**
 * Goals Module - REST API Controller
 *
 * Following SOLID:
 * - Single Responsibility: Only handles HTTP requests
 * - Thin controller: Delegates to GoalsService
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { GoalsService } from './goals.service';
import { CreateGoalDto, UpdateGoalDto, ListGoalsDto } from './dto/goal.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import type { GoalResponseDto } from './dto/goal-response.dto';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

const PLATFORM_ROLES: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);

@Controller({ path: 'goals', version: '1' })
@ApiCommon('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  private resolveTenantId(user: JwtPayload): string {
    if (user.tenantId) return user.tenantId;
    if (PLATFORM_ROLES.has(user.role as UserRole)) return '*';
    throw new Error('Tenant ID required');
  }

  @Post()
  async create(@CurrentUser() user: JwtPayload, @Body() dto: CreateGoalDto) {
    return this.goalsService.create({
      title: dto.title,
      description: dto.description,
      level: dto.level,
      parentId: dto.parentId,
      ownerAgentId: dto.ownerAgentId,
      ownerUserId: dto.ownerUserId,
      departmentId: dto.departmentId,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      projectId: dto.projectId,
    }, this.resolveTenantId(user));
  }

  @Get()
  async findAll(@CurrentUser() user: JwtPayload, @Query() query: ListGoalsDto): Promise<PaginatedResponse<GoalResponseDto>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const { data, total } = await this.goalsService.findAll(this.resolveTenantId(user), { ...query, page, limit });
    return {
      items: data as unknown as GoalResponseDto[],
      pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) },
    };
  }

  @Get('tree')
  async getTree(@CurrentUser() user: JwtPayload) {
    return this.goalsService.getGoalTree(this.resolveTenantId(user));
  }

  @Get('roots')
  async findRoots(@CurrentUser() user: JwtPayload) {
    return this.goalsService.findRootGoals(this.resolveTenantId(user));
  }

  @Get('project/:projectId')
  async findByProject(@CurrentUser() user: JwtPayload, @Param('projectId') projectId: string) {
    return this.goalsService.findByProjectId(projectId, this.resolveTenantId(user));
  }

  @Get(':id')
  @TenantIsolated()
  async findOne(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.findById(id, this.resolveTenantId(user));
  }

  @Get(':id/children')
  async findChildren(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.findByParentId(id, this.resolveTenantId(user));
  }

  @Put(':id')
  async update(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goalsService.update(id, this.resolveTenantId(user), {
      ...dto,
      targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
    });
  }

  @Patch(':id/progress')
  async updateProgress(
    @CurrentUser() user: JwtPayload,
    @Param('id') id: string,
    @Body('progress') progress: number,
  ) {
    return this.goalsService.updateProgress(id, this.resolveTenantId(user), progress);
  }

  @Post(':id/recalculate-progress')
  async recalculateProgress(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    return this.goalsService.recalculateProgressFromTasks(id, this.resolveTenantId(user));
  }

  @Delete(':id')
  async delete(@CurrentUser() user: JwtPayload, @Param('id') id: string) {
    await this.goalsService.delete(id, this.resolveTenantId(user));
    return { success: true, message: 'Goal deleted' };
  }
}
