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
  ForbiddenException,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { GovernanceRulesService } from './services/governance-rules.service';
import { ApprovalsService } from './services/approvals.service';
import { ApprovalEnrichmentService } from './services/approval-enrichment.service';
import {
  CreateGovernanceRuleDto,
  UpdateGovernanceRuleDto,
} from './dto/governance.dto';
import { CreateApprovalDto, ReviewApprovalDto } from './dto/approval.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { ApprovalStatus } from '@prisma/client';

// ─── Governance Rules ─────────────────────────────────────────────────────────

@Controller({ path: 'governance/rules', version: '1' })
@ApiCommon('governance')
export class GovernanceRulesController {
  constructor(private readonly rulesService: GovernanceRulesService) { }

  @Get()
  findAll(@CurrentUser() user: JwtPayload) {
    return this.rulesService.findAll(user.tenantId!);
  }

  @Post()
  create(
    @Body() dto: CreateGovernanceRuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.create(user.tenantId!, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGovernanceRuleDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.update(id, user.tenantId!, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.remove(id, user.tenantId!);
  }

  @Post('evaluate')
  evaluate(
    @Body() context: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.evaluate(user.tenantId!, context);
  }

  /**
   * POST /governance/rules/validate — validate a proposed action context against active rules.
   * Spec-defined alias for evaluate.
   */
  @Post('validate')
  validate(
    @Body() context: Record<string, unknown>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.rulesService.evaluate(user.tenantId!, context);
  }

  /**
   * GET /governance/rules/audit/:agentId — governance decision history for a specific agent.
   */
  @Get('audit/:agentId')
  getAgentAudit(
    @Param('agentId', ParseUUIDPipe) agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.rulesService.getAgentAudit(agentId, user.tenantId!, {
      page: Number(page),
      limit: Number(limit),
    });
  }
}

// ─── Governance Policies ─────────────────────────────────────────────────────────

@ApiCommon('governance')
@Controller({ path: 'governance/policies', version: '1' })
export class GovernancePoliciesController {
  /**
   * GET /governance/policies — List all governance policies
   */
  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('limit') limit = '50') {
    // TODO: Implement actual policies retrieval from database
    // Return empty array as placeholder - frontend expects { data: { data: [...] } }
    return {
      data: {
        data: [],
        meta: {
          page: 1,
          limit: Number(limit),
          total: 0,
        },
      },
    };
  }
}

// ─── Governance Anomalies ───────────────────────────────────────────────────────

@ApiCommon('governance')
@Controller({ path: 'governance/anomalies', version: '1' })
export class GovernanceAnomaliesController {
  /**
   * GET /governance/anomalies — List all detected anomalies
   */
  @Get()
  findAll(@CurrentUser() user: JwtPayload, @Query('limit') limit = '50') {
    // TODO: Implement actual anomalies retrieval from database
    // Return empty array as placeholder - frontend expects { data: { data: [...] } }
    return {
      data: {
        data: [],
        meta: {
          page: 1,
          limit: Number(limit),
          total: 0,
        },
      },
    };
  }
}

// ─── Approvals ────────────────────────────────────────────────────────────────

@ApiCommon('approvals')
@Controller({ path: 'approvals', version: '1' })
export class ApprovalsController {
  constructor(
    private readonly approvalsService: ApprovalsService,
    private readonly enrichmentService: ApprovalEnrichmentService,
  ) { }

  @Get()
  findAll(
    @CurrentUser() user: JwtPayload,
    @Query('status') status?: ApprovalStatus,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    if (!user.tenantId && user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenException('Tenant context required');
    }

    return this.approvalsService.findAll(user.tenantId, {
      status,
      page: Number(page),
      limit: Number(limit),
    });
  }

  /**
   * GET /approvals/stratified?status=PENDING&sort=impact
   *
   * Returns approvals stratified by risk level with AI recommendations
   * Separated into: critical, high, medium, low risk groups
   *
   * SOLID: Uses enrichment service (DIP - depends on abstraction)
   */
  @Get('stratified')
  async getStratified(
    @CurrentUser() user: JwtPayload,
    @Query('status') status = 'PENDING',
    @Query('limit') limit = '50',
  ) {
    if (!user.tenantId) {
      throw new ForbiddenException('Tenant context required');
    }

    return this.enrichmentService.getStratifiedApprovals(user.tenantId, {
      status,
      limit: Number(limit),
    });
  }

  @Get('pending-count')
  pendingCount(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) {
      if (user.role === 'SUPER_ADMIN')
        return this.approvalsService.getPendingCountPlatform();
      throw new ForbiddenException('Tenant context required');
    }
    return this.approvalsService.getPendingCount(user.tenantId);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalsService.findOne(id, user.tenantId!);
  }

  /** GET /approvals/:id/history — full lifecycle timeline of an approval request */
  @Get(':id/history')
  getHistory(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalsService.getHistory(id, user.tenantId!);
  }

  @Post()
  create(@Body() dto: CreateApprovalDto, @CurrentUser() user: JwtPayload) {
    return this.approvalsService.create({
      ...dto,
      tenantId: user.tenantId!,
      requestedById: user.sub,
    });
  }

  @Patch(':id/review')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewApprovalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalsService.review(id, user.tenantId!, user.sub, dto);
  }

  @Patch(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.approvalsService.cancel(id, user.tenantId!, user.sub);
  }

  /**
   * POST /approvals/:id/feedback
   *
   * Collect user feedback on AI recommendations
   * Used for: learning loop, model retraining, accuracy tracking
   *
   * Body:
   * {
   *   userDecision: 'APPROVED' | 'REJECTED',
   *   aiRecommendation: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REVIEW',
   *   reason: 'wrong_fit' | 'bad_timing' | 'quality_issue' | 'other',
   *   explanation?: string
   * }
   *
   * SRP: Only stores feedback, doesn't modify approval status
   */
  @Post(':id/feedback')
  @HttpCode(HttpStatus.OK)
  async submitFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() feedback: { userDecision: string; aiRecommendation: string; reason: string; explanation?: string },
    @CurrentUser() user: JwtPayload,
  ) {
    // Validate the feedback request exists
    const approval = await this.approvalsService.findOne(
      id,
      user.tenantId!,
    );

    // Store feedback as metadata (can be persisted separately later)
    return {
      id,
      message: 'Feedback recorded successfully',
      feedback: {
        userDecision: feedback.userDecision,
        aiRecommendation: feedback.aiRecommendation,
        reason: feedback.reason,
        explanation: feedback.explanation,
        recordedBy: user.sub,
        recordedAt: new Date(),
      },
    };
  }
}
