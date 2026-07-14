/**
 * Enterprise OS API (Phase 7). Executive cockpit, simulation, forecast,
 * optimization, analytics, performance, resilience, resource, strategy.
 * Tenant + actor from JWT. Read-only surface — never executes mutations.
 */

import { Body, Controller, Get, Post, Req, UseGuards, ForbiddenException, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ENTERPRISE_OS } from './contracts/enterprise-operating-system.interface';
import type { IEnterpriseOperatingSystem, ScenarioKind } from './contracts/enterprise-operating-system.interface';

interface ReqWithUser { user?: { tenantId?: string; sub?: string; id?: string } }

@Controller({ path: 'enterprise-os', version: '1' })
@UseGuards(JwtAuthGuard)
export class EnterpriseOSController {
  constructor(@Inject(ENTERPRISE_OS) private readonly eos: IEnterpriseOperatingSystem) {}
  private ctx(req: ReqWithUser) { const t = req.user?.tenantId; const a = req.user?.sub ?? req.user?.id; if (!t || !a) throw new ForbiddenException(); return { tenantId: t, actorId: a }; }

  @Get('cockpit') cockpit(@Req() req: ReqWithUser) { return this.eos.cockpit(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('twin') twin(@Req() req: ReqWithUser) { return this.eos.twin(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('forecast') forecast(@Req() req: ReqWithUser) { return this.eos.forecast(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('optimize') optimize(@Req() req: ReqWithUser) { return this.eos.optimize(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('performance') performance(@Req() req: ReqWithUser) { return this.eos.performance(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('resilience') resilience(@Req() req: ReqWithUser) { return this.eos.resilience(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('analytics') analytics(@Req() req: ReqWithUser) { return this.eos.analytics(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('resource') resource(@Req() req: ReqWithUser) { return this.eos.resource(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('strategy') strategy(@Req() req: ReqWithUser) { return this.eos.strategy(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Post('simulate') simulate(@Req() req: ReqWithUser, @Body() b: { kind: ScenarioKind; label?: string; params?: Record<string, unknown> }) {
    return this.eos.simulate({ tenantId: this.ctx(req).tenantId, kind: b.kind, label: b.label ?? b.kind, params: b.params ?? {} }, this.ctx(req).actorId);
  }
}
