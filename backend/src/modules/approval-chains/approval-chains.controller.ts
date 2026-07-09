/**
 * approval-chains module — REST API Controller
 *
 * Phase 4: Approval chain resolution + management.
 * SOLID: Thin controller — delegates to ApprovalChainsService.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApprovalChainsService } from './approval-chains.service';
import {
  ResolveApprovalChainDto,
  ListApprovalWorkflowsDto,
} from './dto/approval-chain.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@ApiCommon('approval-chains')
@Controller({ path: 'approval-chains', version: '1' })
@UseGuards(JwtAuthGuard)
export class ApprovalChainsController {
  constructor(private readonly chainService: ApprovalChainsService) {}

  /**
   * Resolve the approval chain for a deliverable.
   * POST /approval-chains/resolve
   */
  @Post('resolve')
  @HttpCode(HttpStatus.OK)
  async resolveChain(@CurrentUser() user: JwtPayload, @Body() dto: ResolveApprovalChainDto) {
    return this.chainService.resolveChain(
      dto.deliverableId,
      dto.projectTypeVersionId,
      user.tenantId ?? '',
    );
  }

  /**
   * Get pending approval workflows for the tenant.
   * GET /approval-chains/pending
   */
  @Get('pending')
  async findPending(
    @CurrentUser() user: JwtPayload,
    @Query() query: ListApprovalWorkflowsDto,
  ) {
    return this.chainService.findPendingWorkflows(
      user.tenantId ?? '',
      query.riskTier,
    );
  }

  /**
   * Get the current step of an approval workflow.
   * GET /approval-chains/:workflowId/current-step
   */
  @Get(':workflowId/current-step')
  async getCurrentStep(@Param('workflowId') workflowId: string) {
    return this.chainService.getCurrentStep(workflowId);
  }

  /**
   * Check if a step is blocked by its prior step.
   * GET /approval-chains/steps/:stepId/blocked
   */
  @Get('steps/:stepId/blocked')
  async isStepBlocked(@Param('stepId') stepId: string) {
    const blocked = await this.chainService.isStepBlocked(stepId);
    return { blocked };
  }

  /**
   * Advance workflow to next sequential step.
   * POST /approval-chains/:workflowId/advance
   */
  @Post(':workflowId/advance')
  @HttpCode(HttpStatus.NO_CONTENT)
  async advanceChain(@Param('workflowId') workflowId: string) {
    await this.chainService.advanceChain(workflowId);
  }
}
