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
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { TasksService } from './services/tasks.service';
import { WorkflowsService } from './services/workflows.service';
import { CreateTaskDto, UpdateTaskDto } from './dto/task.dto';
import { CreateWorkflowDto, UpdateWorkflowDto } from './dto/workflow.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { TaskStatus, WorkflowStatus } from '@prisma/client';
import { TenantIsolated } from '../../common/guards/tenant-isolated.decorator';

@ApiCommon('orchestration')
@Controller({ version: '1' })
export class OrchestrationController {
  constructor(
    private readonly tasksService: TasksService,
    private readonly workflowsService: WorkflowsService,
  ) {}

  // ─── Tasks ────────────────────────────────────────────────

  @Get('tasks')
  findAllTasks(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: TaskStatus,
    @Query('agentId') agentId?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.tasksService.findAll({
      status,
      agentId,
      page: Number(page),
      limit: Number(limit),
    }, user.tenantId);
  }

  @Get('tasks/:id')
  @TenantIsolated()
  findOneTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.tasksService.findOne(id, user.tenantId);
  }

  @Post('tasks')
  createTask(@Body() dto: CreateTaskDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.tasksService.create({
      ...dto,
      createdById: user.sub,
    }, user.tenantId);
  }

  @Patch('tasks/:id')
  updateTask(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTaskDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.tasksService.update(id, dto, user.tenantId);
  }

  @Delete('tasks/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeTask(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.tasksService.remove(id, user.tenantId);
  }

  // ─── Workflows ────────────────────────────────────────────

  @Get('workflows')
  findAllWorkflows(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: WorkflowStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.findAll({
      status,
      page: Number(page),
      limit: Number(limit),
    }, user.tenantId);
  }

  @Get('workflows/:id')
  @TenantIsolated()
  findOneWorkflow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.findOne(id, user.tenantId);
  }

  @Post('workflows')
  createWorkflow(@Body() dto: CreateWorkflowDto, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.create(dto, user.tenantId);
  }

  @Patch('workflows/:id')
  updateWorkflow(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateWorkflowDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.update(id, dto, user.tenantId);
  }

  @Post('workflows/:id/activate')
  activate(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.activate(id, user.tenantId);
  }

  @Post('workflows/:id/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  execute(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.execute(id, user.tenantId);
  }

  @Get('workflows/:id/status')
  getStatus(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.getStatus(id, user.tenantId);
  }

  @Delete('workflows/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  removeWorkflow(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.workflowsService.remove(id, user.tenantId);
  }
}
