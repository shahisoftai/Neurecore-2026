/**
 * AI Governance API (Phase 13). Trust evaluations, hallucination monitoring,
 * bias detection, policy management, model registry, human review queue,
 * governance dashboard. Tenant-scoped. All trust scores are categorical.
 */
import { Body, Controller, Get, Param, Post, Patch, Req, UseGuards, ForbiddenException, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AI_GOVERNANCE } from './ai-governance.service';
import type { IAIGovernancePlatform } from './ai-governance.service';

@Controller({ path: 'ai-governance', version: '1' })
@UseGuards(JwtAuthGuard)
export class AIGovernanceController {
  constructor(@Inject(AI_GOVERNANCE) private readonly g: IAIGovernancePlatform) {}
  private t = (req: any) => req.user?.tenantId!;

  @Get('dashboard') dash(@Req() req: any) { return this.g.dashboard(this.t(req)); }
  @Post('trust') trust(@Req() req: any, @Body() b: { sourceType: string; sourceId: string; evidence: Record<string,unknown>; reasoning: string }) { return this.g.evaluate(b.sourceType, b.sourceId, this.t(req), b.evidence ?? {}, b.reasoning ?? ''); }
  @Get('trust') listTrust(@Req() req: any) { return this.g.listTrustEvaluations(this.t(req)); }
  @Post('hallucination') flagHallucination(@Req() req: any, @Body() b: { sourceType: string; sourceId: string; claim: string; evidenceGap: string; severity?: string }) { return this.g.flagHallucination(this.t(req), b.sourceType, b.sourceId, b.claim, b.evidenceGap, b.severity as any); }
  @Get('hallucination') listHallucinations(@Req() req: any) { return this.g.listHallucinations(this.t(req)); }
  @Post('bias') recordBias(@Req() req: any, @Body() b: { category: string; detail: string; severity?: string }) { return this.g.recordBias(this.t(req), b.category, b.detail, b.severity as any); }
  @Get('bias') listBias(@Req() req: any) { return this.g.listBias(this.t(req)); }
  @Post('policies') createPolicy(@Req() req: any, @Body() b: { name: string; category: string; rules?: Record<string,unknown> }) { return this.g.createPolicy(this.t(req), b.name, b.category, b.rules); }
  @Get('policies') listPolicies(@Req() req: any) { return this.g.listPolicies(this.t(req)); }
  @Post('models') registerModel(@Req() req: any, @Body() b: { modelName: string; provider: string; capabilities?: string[] }) { return this.g.registerModel(this.t(req), b.modelName, b.provider, b.capabilities); }
  @Get('models') listModels(@Req() req: any) { return this.g.listModels(this.t(req)); }
  @Post('reviews') createReview(@Req() req: any, @Body() b: { sourceType: string; sourceId: string }) { return this.g.createReview(this.t(req), b.sourceType, b.sourceId); }
  @Patch('reviews/:id') decideReview(@Req() req: any, @Param('id') id: string, @Body() b: { decision: string; reviewerId: string; reason?: string }) { return this.g.decideReview(this.t(req), id, b.decision, b.reviewerId, b.reason); }
  @Get('reviews') listReviews(@Req() req: any) { return this.g.listReviews(this.t(req)); }
}
