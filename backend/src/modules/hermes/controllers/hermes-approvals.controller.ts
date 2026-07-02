import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApprovalWorkflowEngine } from '../services/approval-workflow.engine';
import { HermesTenantGuard } from '../guards/hermes-tenant.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import type { ApprovalDecision } from '../interfaces/approval-workflow.interface';

@Controller({ path: 'hermes/approvals', version: '1' })
@UseGuards(HermesTenantGuard)
export class HermesApprovalsController {
  constructor(private readonly engine: ApprovalWorkflowEngine) {}

  @Post(':workflowId/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { decision: ApprovalDecision; comment?: string },
  ) {
    const canApprove = await this.engine.canApprove(
      workflowId,
      user.sub,
      user.tenantId!,
    );
    if (!canApprove) {
      return {
        success: false,
        error: 'Not authorized to approve this workflow',
      };
    }

    const result = await this.engine.advance(
      workflowId,
      user.sub,
      body.decision,
      body.comment,
    );

    return { success: true, workflow: result };
  }

  @Post(':workflowId/cancel')
  @HttpCode(HttpStatus.OK)
  async cancel(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { reason?: string },
  ) {
    await this.engine.cancel(workflowId, user.sub, body.reason);
    return { success: true };
  }

  @Get(':workflowId')
  async getStatus(
    @Param('workflowId', ParseUUIDPipe) workflowId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const workflow = await this.engine.getStatus(workflowId, user.tenantId!);
    if (!workflow) {
      return { success: false, error: 'Workflow not found' };
    }
    return { success: true, workflow };
  }

  @Get()
  async getPending(
    @CurrentUser() user: JwtPayload,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const workflows = await this.engine.getPendingForApprover(
      user.sub,
      user.tenantId!,
    );
    return { success: true, workflows };
  }

  @Post(':workflowId/expire')
  @HttpCode(HttpStatus.OK)
  async expire(@Param('workflowId', ParseUUIDPipe) workflowId: string) {
    await this.engine.expire(workflowId);
    return { success: true };
  }

  @Post('expire-old')
  @HttpCode(HttpStatus.OK)
  async expireOld(
    @Query('hours') hours?: string,
    @Query('tenantId') tenantId?: string,
  ) {
    const count = await this.engine.expireOldWorkflows(
      hours ? parseInt(hours, 10) : 72,
      tenantId,
    );
    return { success: true, expired: count };
  }
}
