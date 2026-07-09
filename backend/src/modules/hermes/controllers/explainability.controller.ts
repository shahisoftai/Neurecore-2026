import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { HermesTenantGuard } from '../guards/hermes-tenant.guard';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { JwtPayload } from '../../auth/interfaces/token.interface';
import { UserRole } from '@prisma/client';

/**
 * ExplainabilityController — Phase 6.
 * Decision history with RBAC: only AUDITOR/SUPER_ADMIN see raw
 * request/response fields. Other roles see the decision metadata.
 */
@Controller({ path: 'hermes/explain', version: '1' })
@UseGuards(JwtAuthGuard, HermesTenantGuard, RolesGuard)
export class ExplainabilityController {
  constructor(private readonly prisma: PrismaService) {}

  @Get(':agentId/decisions')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN, UserRole.AUDITOR, UserRole.OWNER)
  async getDecisions(
    @Param('agentId') agentId: string,
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
  ) {
    const logs = await this.prisma.hermesAuditLog.findMany({
      where: { hermesAgentId: agentId, tenantId: user.tenantId ?? '' },
      orderBy: { createdAt: 'desc' },
      take: limit ? parseInt(limit, 10) : 20,
      select: {
        id: true,
        action: true,
        resource: true,
        resourceId: true,
        decision: true,
        reason: true,
        governanceRule: true,
        durationMs: true,
        costUsd: true,
        tokensUsed: true,
        createdAt: true,
        ...(user.role === UserRole.AUDITOR || user.role === UserRole.SUPER_ADMIN
          ? { request: true, response: true }
          : {}),
      },
    });
    return { status: 'success', data: { decisions: logs } };
  }
}
