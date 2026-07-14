/**
 * Enterprise Intelligence Network API (Phase 9).
 * Knowledge Graph Explorer, Semantic Search, Knowledge Reasoning, Discovery,
 * Health, Relationship Refresh. Tenant-scoped, read-only.
 */

import { Body, Controller, Get, Post, Req, Param, UseGuards, ForbiddenException, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ENTERPRISE_INTELLIGENCE } from './contracts/enterprise-intelligence.interface';
import type { IEnterpriseIntelligenceNetwork } from './contracts/enterprise-intelligence.interface';

interface ReqWithUser { user?: { tenantId?: string; sub?: string } }

@Controller({ path: 'enterprise-intelligence', version: '1' })
@UseGuards(JwtAuthGuard)
export class EnterpriseIntelligenceController {
  constructor(@Inject(ENTERPRISE_INTELLIGENCE) private readonly ein: IEnterpriseIntelligenceNetwork) {}
  private ctx = (req: ReqWithUser) => ({ tenantId: req.user?.tenantId!, actorId: (req.user?.sub ?? (req.user as any)?.id) as string });

  @Get('health') health(@Req() req: ReqWithUser) { return this.ein.health(this.ctx(req).tenantId); }
  @Get('search') search(@Req() req: ReqWithUser, @Body('query') query: string) { return this.ein.search(this.ctx(req).tenantId, query); }
  @Post('reason') reason(@Req() req: ReqWithUser, @Body('question') q: string) { return this.ein.reason(this.ctx(req).tenantId, q); }
  @Get('discover') discover(@Req() req: ReqWithUser) { return this.ein.discover(this.ctx(req).tenantId); }
  @Post('refresh') refresh(@Req() req: ReqWithUser) { return this.ein.refresh(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('traverse/:nodeId') traverse(@Req() req: ReqWithUser, @Param('nodeId') id: string) { return this.ein.graph().traverse(this.ctx(req).tenantId, id); }
}
