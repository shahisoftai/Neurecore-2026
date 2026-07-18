/**
 * ApprovalPortController — Phase 7 (ADR-006)
 *
 * HTTP entry points for the Capability Approval Port.
 * All approval requests route through here — there is no direct CRUD on
 * ApprovalWorkflow or ApprovalRequest models without going through the port.
 *
 * SOLID:
 *   SRP — HTTP layer only; all business logic in ApprovalPortService
 *   DIP — depends on IApprovalPort, not the concrete service
 */

import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Query,
  Headers,
  HttpCode,
  HttpStatus,
  BadRequestException,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import type { RiskTier, ApprovalPriority } from '@prisma/client';
import { APPROVAL_PORT } from './approval-port.interface';
import type {
  IApprovalPort,
  ApprovalContext,
  WorkActor,
  ApprovalRequestData,
  ApprovalDecision,
} from './approval-port.interface';

@Controller('approvals')
export class ApprovalPortController {
  constructor(
    @Inject(APPROVAL_PORT)
    private readonly approvalPort: IApprovalPort,
  ) {}

  @Post('request')
  @HttpCode(HttpStatus.OK)
  async requestApproval(
    @Body() body: RequestApprovalBody,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-type') userType: string = 'HUMAN',
    @Headers('x-user-role') userRole: string = 'PROJECT_MANAGER',
  ) {
    if (!tenantId) throw new UnauthorizedException('x-tenant-id header required');
    if (!userId) throw new UnauthorizedException('x-user-id header required');
    if (!body.context?.resourceType) {
      throw new BadRequestException('context.resourceType is required');
    }
    if (!body.request?.title) {
      throw new BadRequestException('request.title is required');
    }

    const actor: WorkActor = {
      id: userId,
      type: userType as WorkActor['type'],
      tenantId,
      role: userRole,
    };

    const context: ApprovalContext = {
      tenantId,
      projectId: body.context.projectId ?? null,
      resourceType: body.context.resourceType,
      resourceId: body.context.resourceId ?? '',
      riskTier: (body.context.riskTier ?? null) as RiskTier | null,
      priority: (body.context.priority ?? 'MEDIUM') as ApprovalPriority,
      amount: body.context.amount ?? null,
      currency: body.context.currency ?? null,
    };

    const request: ApprovalRequestData = {
      title: body.request.title,
      description: body.request.description ?? null,
      payload: body.request.payload ?? null,
      expiresAt: body.request.expiresAt ?? null,
      workRequestId: body.request.workRequestId ?? null,
      correlationId: body.request.correlationId ?? `req-${Date.now()}`,
    };

    return this.approvalPort.request(context, actor, request);
  }

  @Post('decide')
  @HttpCode(HttpStatus.OK)
  async decide(
    @Body() body: DecideBody,
    @Headers('x-tenant-id') tenantId: string,
    @Headers('x-user-id') userId: string,
    @Headers('x-user-type') userType: string = 'HUMAN',
    @Headers('x-user-role') userRole: string = 'PROJECT_MANAGER',
  ) {
    if (!tenantId) throw new UnauthorizedException('x-tenant-id header required');
    if (!userId) throw new UnauthorizedException('x-user-id header required');
    if (!body.approvalId) throw new BadRequestException('approvalId is required');
    if (!body.decision) {
      throw new BadRequestException('decision is required (APPROVED|REJECTED|RETURNED_FOR_REVISION)');
    }

    const reviewer: WorkActor = {
      id: userId,
      type: userType as WorkActor['type'],
      tenantId,
      role: userRole,
    };

    const decision: ApprovalDecision = {
      approvalId: body.approvalId,
      decision: body.decision,
      reason: body.reason ?? null,
      revisionInstructions: body.revisionInstructions ?? null,
      correlationId: body.correlationId ?? `dec-${Date.now()}`,
    };

    return this.approvalPort.decide(decision, reviewer, body.comment);
  }

  @Get('status/:approvalId')
  async getStatus(
    @Param('approvalId') approvalId: string,
    @Query('tenantId') tenantId: string,
    @Headers('x-tenant-id') headerTenantId: string,
  ) {
    const tid = tenantId ?? headerTenantId;
    if (!tid) throw new UnauthorizedException('tenantId is required');

    const status = await this.approvalPort.getStatus(approvalId, tid);
    if (!status) {
      throw new BadRequestException(`Approval ${approvalId} not found`);
    }
    return status;
  }

  @Get('evaluate')
  async evaluateRequirement(
    @Query('tenantId') tenantId: string,
    @Query('resourceType') resourceType: string,
    @Query('resourceId') resourceId: string,
    @Query('projectId') projectId: string | undefined,
    @Query('riskTier') riskTier: string | undefined,
    @Query('priority') priority: string = 'MEDIUM',
    @Query('amount') amount: string | undefined,
    @Query('currency') currency: string | undefined,
    @Query('userId') userId: string,
    @Query('userType') userType: string = 'HUMAN',
    @Headers('x-tenant-id') headerTenantId: string,
  ) {
    const tid = tenantId ?? headerTenantId;
    if (!tid) throw new UnauthorizedException('tenantId is required');
    if (!resourceType) throw new BadRequestException('resourceType is required');
    if (!userId) throw new UnauthorizedException('userId is required');

    const actor: WorkActor = {
      id: userId,
      type: userType as WorkActor['type'],
      tenantId: tid,
    };

    const context: ApprovalContext = {
      tenantId: tid,
      projectId: projectId ?? null,
      resourceType,
      resourceId: resourceId ?? '',
      riskTier: riskTier as any ?? null,
      priority: priority as any ?? 'MEDIUM',
      amount: amount ? parseFloat(amount) : null,
      currency: currency ?? null,
    };

    return this.approvalPort.evaluateRequirement(context, actor);
  }

  @Delete(':approvalId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @Param('approvalId') approvalId: string,
    @Query('actorId') actorId: string,
    @Query('tenantId') tenantId: string,
    @Headers('x-tenant-id') headerTenantId: string,
  ) {
    const tid = tenantId ?? headerTenantId;
    if (!tid) throw new UnauthorizedException('tenantId is required');
    if (!actorId) throw new UnauthorizedException('actorId is required');

    await this.approvalPort.cancel(approvalId, actorId, tid);
  }
}

// ─── DTOs ─────────────────────────────────────────────────────────────────────

interface RequestApprovalBody {
  context: {
    projectId?: string;
    resourceType: string;
    resourceId?: string;
    riskTier?: string;
    priority?: string;
    amount?: number;
    currency?: string;
  };
  request: {
    title: string;
    description?: string;
    payload?: Record<string, unknown>;
    expiresAt?: string;
    workRequestId?: string;
    correlationId?: string;
  };
}

interface DecideBody {
  approvalId: string;
  decision: 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_REVISION';
  reason?: string;
  revisionInstructions?: string;
  comment?: string;
  correlationId?: string;
}
