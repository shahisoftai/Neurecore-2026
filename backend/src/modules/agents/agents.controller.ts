import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AgentsService } from './services/agents.service';
import { AgentExecutorService } from './services/agent-executor.service';
import { CreateAgentDto } from './dto/create-agent.dto';
import { UpdateAgentDto } from './dto/update-agent.dto';
import { DispatchTaskDto } from './dto/dispatch-task.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';

import { assertSameTenant } from '../../common/utils/assert-same-tenant';
import { EntityOwnerGuard } from '../../common/guards/entity-owner.guard';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaginatedResponse } from '../../common/responses/paginated.response';
import { ActionResult } from '../../common/responses/action-result.response';
import type { AgentResponseDto } from './dto/agent-response.dto';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { AgentStatus, AgentType, UserRole } from '@prisma/client';

const PLATFORM_ROLES_AGENTS: ReadonlySet<UserRole> = new Set([
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
]);
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { IsArray, IsOptional, IsString } from 'class-validator';

class UpdatePermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissions!: string[];

  @IsOptional()
  @IsString()
  budgetPerDay?: string;
}

@Controller({ path: 'agents', version: '1' })
@ApiCommon('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly executorService: AgentExecutorService,
  ) { }

  @Get()
  async findAll(
    @CurrentUser() user: JwtPayload,
    @Query() pagination: PaginationDto,
    @Query('departmentId') departmentId?: string,
    @Query('status') status?: AgentStatus,
    @Query('type') type?: AgentType,
  ): Promise<PaginatedResponse<AgentResponseDto>> {
    // FIX-010: platform roles get '*' wildcard → cross-tenant query.
    // Non-platform roles use JWT tenantId. Services skip tenant filter for '*'.
    const tenantId = user.tenantId
      ? user.tenantId
      : PLATFORM_ROLES_AGENTS.has(user.role as UserRole)
        ? '*'
        : undefined;
    const { data, total, page, limit } = await this.agentsService.findAll({
      departmentId,
      status,
      type,
      page: pagination.page,
      limit: pagination.limit,
    }, tenantId);

    return {
      items: data as unknown as AgentResponseDto[],
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get(':id')
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const agent = await this.agentsService.findOne(id, user.tenantId);
    assertSameTenant(user, (agent as { tenantId?: string | null })?.tenantId, {
      resourceType: 'agent',
      resourceId: id,
    });
    return agent;
  }

  @Get(':id/status')
  getStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.findOne(id, user.tenantId);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  create(
    @Body() dto: CreateAgentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.create(dto, user.sub, user.tenantId);
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAgentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.update(id, dto, user.tenantId);
  }

  @Patch(':id/permissions')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  updatePermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePermissionsDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.update(id, {
      permissions: dto.permissions,
      budgetPerDay: dto.budgetPerDay,
    } as UpdateAgentDto, user.tenantId);
  }

  @Patch(':id/integration-config')
  @HttpCode(HttpStatus.OK)
  updateIntegrationConfig(
    @Param('id', ParseUUIDPipe) id: string,
    @Body()
    dto: {
      emailAlias?: string;
      emailProvider?: 'gmail' | 'brevo';
      emailDisplayName?: string;
      emailSignature?: string;
      googleDriveFolderId?: string;
    },
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.update(id, {
      emailAlias: dto.emailAlias,
      emailProvider: dto.emailProvider,
      emailDisplayName: dto.emailDisplayName,
      emailSignature: dto.emailSignature,
      googleDriveFolderId: dto.googleDriveFolderId,
    } as never, user.tenantId);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  async pause(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActionResult<AgentResponseDto>> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const agent = await this.agentsService.updateStatus(
      id,
      AgentStatus.PAUSED,
      user.tenantId,
    );
    return {
      success: true,
      message: 'Agent paused',
      data: agent as unknown as AgentResponseDto,
    };
  }

  @Post(':id/resume')
  @HttpCode(HttpStatus.OK)
  async resume(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActionResult<AgentResponseDto>> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const agent = await this.agentsService.updateStatus(id, AgentStatus.IDLE, user.tenantId);
    return {
      success: true,
      message: 'Agent resumed',
      data: agent as unknown as AgentResponseDto,
    };
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.PLATFORM_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.remove(id, user.tenantId);
  }

  @Patch(':id/archive')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  archive(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.setStatus(id, 'ARCHIVED', user.tenantId);
  }

  @Patch(':id/deprecate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  deprecate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.setStatus(id, 'DEPRECATED', user.tenantId);
  }

  @Patch(':id/restore')
  @Roles(UserRole.SUPER_ADMIN, UserRole.OWNER, UserRole.ADMIN)
  restore(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.setStatus(id, 'IDLE', user.tenantId);
  }

  @Post(':id/dispatch')
  @HttpCode(HttpStatus.ACCEPTED)
  async dispatch(
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() dto: DispatchTaskDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActionResult<{ taskId: string; agentId: string }>> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    void this.executorService.executeTask(
      dto.taskId,
      agentId,
      user.tenantId,
    );
    return {
      success: true,
      message: 'Task dispatched',
      data: { taskId: dto.taskId, agentId },
    };
  }

  @Post(':id/task')
  @HttpCode(HttpStatus.ACCEPTED)
  async dispatchTask(
    @Param('id', ParseUUIDPipe) agentId: string,
    @Body() dto: DispatchTaskDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ActionResult<{ taskId: string; agentId: string }>> {
    if (!user.tenantId) throw new Error('Tenant ID required');
    void this.executorService.executeTask(
      dto.taskId,
      agentId,
      user.tenantId,
    );
    return {
      success: true,
      message: 'Task dispatched',
      data: { taskId: dto.taskId, agentId },
    };
  }

  @Post(':id/cancel/:taskId')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<ActionResult<null>> {
    await this.executorService.cancelTask(taskId);
    return { success: true, message: 'Task cancelled' };
  }

  /**
   * Get agent orchestration data
   * SOLID: SRP - Only routing
   * Returns all agents with their status, current tasks, and performance metrics
   *
   * @param user - Current user from JWT
   * @returns Agent orchestration response with summary
   */
  @Get('orchestration')
  async getOrchestration(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.agentsService.getOrchestrationData(user.tenantId);
  }
}
