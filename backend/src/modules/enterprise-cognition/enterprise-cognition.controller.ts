/**
 * Enterprise Cognition API (Phase 5). Tenant + actor from JWT (no impersonation).
 * Recommend-only surface: cognize returns reasoning + recommendations; it does
 * NOT execute. autoHandoff (opt-in) routes executable recommendations to the
 * governed Work Runtime, which governs execution.
 */

import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ENTERPRISE_COGNITION,
  AGENT_SELECTOR,
} from './contracts/enterprise-cognition.interface';
import type {
  IEnterpriseCognition,
  IAgentSelector,
} from './contracts/enterprise-cognition.interface';

interface RequestWithUser {
  user?: { tenantId?: string; sub?: string; id?: string };
}

@Controller({ path: 'enterprise-cognition', version: '1' })
@UseGuards(JwtAuthGuard)
export class EnterpriseCognitionController {
  constructor(
    @Inject(ENTERPRISE_COGNITION) private readonly cognition: IEnterpriseCognition,
    @Inject(AGENT_SELECTOR) private readonly selector: IAgentSelector,
  ) {}

  private ctx(req: RequestWithUser): { tenantId: string; actorId: string } {
    const tenantId = req.user?.tenantId;
    const actorId = req.user?.sub ?? req.user?.id;
    if (!tenantId || !actorId) throw new ForbiddenException('tenant + actor required');
    return { tenantId, actorId };
  }

  /** Reason about a request; returns objective, decomposition, opinions,
   *  recommendations (with evidence + confidence), strategy findings, score.
   *  Recommend-only unless autoHandoff=true (then governed Work Runtime runs). */
  @Post('cognize')
  async cognize(
    @Req() req: RequestWithUser,
    @Body() body: { request: string; projectId?: string; customerId?: string; departmentId?: string; includeCapabilities?: string[]; autoHandoff?: boolean },
  ) {
    const { tenantId, actorId } = this.ctx(req);
    return this.cognition.cognize({
      tenantId,
      actorId,
      actorType: 'HUMAN',
      request: body.request,
      scope: {
        projectId: body.projectId,
        customerId: body.customerId,
        departmentId: body.departmentId,
        includeCapabilities: body.includeCapabilities,
      },
      autoHandoff: body.autoHandoff === true,
    });
  }

  @Get('specialists')
  specialists(@Req() req: RequestWithUser) {
    this.ctx(req);
    return { specialists: this.selector.listAll() };
  }
}
