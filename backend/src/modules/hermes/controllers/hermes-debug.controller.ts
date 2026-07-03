import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { HermesRegistryService } from '../services/hermes-registry.service';
import { HermesRuntimeService } from '../services/hermes-runtime.service';
import { HermesMemoryService } from '../services/hermes-memory.service';
import { HermesSessionService } from '../services/hermes-session.service';
import { HermesEventBusService } from '../services/hermes-event-bus.service';
import { ToolGatewayService } from '../services/tool-gateway.service';
import { PermissionMatrixService } from '../services/permission-matrix.service';
import { ApprovalWorkflowEngine } from '../services/approval-workflow.engine';
import {
  CreateApprovalWorkflowDto,
  AdvanceStepDto,
} from '../dto/approval-workflow.dto';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@Controller({ path: 'hermes/debug', version: '1' })
@ApiCommon('Hermes Debug')
export class HermesDebugController {
  constructor(
    private readonly registryService: HermesRegistryService,
    private readonly runtimeService: HermesRuntimeService,
    private readonly memoryService: HermesMemoryService,
    private readonly sessionService: HermesSessionService,
    private readonly eventBus: HermesEventBusService,
    private readonly toolGateway: ToolGatewayService,
    private readonly permissionMatrix: PermissionMatrixService,
    private readonly approvalEngine: ApprovalWorkflowEngine,
  ) {}

  @Get('health')
  @ApiOperation({ summary: 'Get Hermes system health' })
  async getHealth(@CurrentUser() user: JwtPayload) {
    const agents = await this.registryService.listAgents(
      user.tenantId!,
    );

    const activeAgents = agents.filter((a) => a.status === 'RUNNING').length;
    const idleAgents = agents.filter((a) => a.status === 'IDLE').length;
    const suspendedAgents = agents.filter((a) => a.status === 'SUSPENDED').length;

    return {
      totalAgents: agents.length,
      activeAgents,
      idleAgents,
      suspendedAgents,
      ok: true,
    };
  }

  @Get('agents/:agentId/status')
  @ApiOperation({ summary: 'Get agent runtime status' })
  async getAgentStatus(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
  ) {
    const status = await this.runtimeService.getStatus(
      agentId,
      user.tenantId!,
    );

    const stats = await this.memoryService.getMemoryStats(
      agentId,
      user.tenantId!,
    );

    return { agentId, status, memoryStats: stats };
  }

  @Post('agents/:agentId/suspend')
  @ApiOperation({ summary: 'Suspend a Hermes agent' })
  async suspendAgent(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
  ) {
    await this.runtimeService.suspend(
      agentId,
      user.tenantId!,
    );
    return { success: true };
  }

  @Post('agents/:agentId/resume')
  @ApiOperation({ summary: 'Resume a Hermes agent' })
  async resumeAgent(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
  ) {
    await this.runtimeService.resume(
      agentId,
      user.tenantId!,
    );
    return { success: true };
  }

  @Get('agents/:agentId/tools')
  @ApiOperation({ summary: 'Get tool menu for agent' })
  async getAgentTools(
    @CurrentUser() user: JwtPayload,
    @Param('agentId') agentId: string,
  ) {
    return this.toolGateway.buildToolMenu(
      agentId,
      user.tenantId!,
    );
  }

  @Get('permissions')
  @ApiOperation({ summary: 'Get permission matrix' })
  async getPermissions(@CurrentUser() user: JwtPayload) {
    return this.permissionMatrix.getMatrix(user.tenantId!);
  }

  @Post('workflows')
  @ApiOperation({ summary: 'Create approval workflow' })
  async createWorkflow(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateApprovalWorkflowDto,
  ) {
    return this.approvalEngine.createWorkflow({
      name: dto.name,
      description: dto.description,
      workflowType: dto.workflowType,
      context: dto.context,
      steps: dto.steps,
      requesterId: user.sub,
      tenantId: user.tenantId!,
      workspaceId: dto.workspaceId,
      routineRunId: dto.routineRunId,
    });
  }

  @Get('workflows/:workflowId')
  @ApiOperation({ summary: 'Get workflow status' })
  async getWorkflow(
    @CurrentUser() user: JwtPayload,
    @Param('workflowId') workflowId: string,
  ) {
    return this.approvalEngine.getWorkflowStatus(
      workflowId,
      user.tenantId!,
    );
  }

  @Post('workflows/:workflowId/advance')
  @ApiOperation({ summary: 'Advance approval workflow step' })
  async advanceWorkflow(
    @CurrentUser() user: JwtPayload,
    @Param('workflowId') workflowId: string,
    @Body() dto: AdvanceStepDto,
  ) {
    return this.approvalEngine.advanceStep(
      workflowId,
      user.sub,
      dto.decision as any,
      dto.comment,
    );
  }

  @Get('sessions/:sessionId/events')
  @ApiOperation({ summary: 'Get event history for session' })
  async getSessionEvents(
    @Param('sessionId') sessionId: string,
  ) {
    return this.eventBus.getEventsForSession(sessionId);
  }

  @Post('sessions/expire')
  @ApiOperation({ summary: 'Expire stale sessions' })
  async expireSessions(@CurrentUser() user: JwtPayload) {
    const count = await this.sessionService.expireStaleSessions(
      user.tenantId!,
    );
    return { expired: count };
  }

  @Post('workflows/expire')
  @ApiOperation({ summary: 'Handle expired workflows' })
  async expireWorkflows(@CurrentUser() user: JwtPayload) {
    const count = await this.approvalEngine.handleExpiredWorkflows(
      user.tenantId!,
    );
    return { expired: count };
  }
}
