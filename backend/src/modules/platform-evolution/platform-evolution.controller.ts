/**
 * Platform Evolution API (Phase 14). Technology Radar, Benchmarks,
 * Experiments, Feature Lifecycle, Capability Versions, Migration Plans.
 * All governed — produce recommendations/plans, NEVER auto-execute.
 */
import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, ForbiddenException, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PLATFORM_EVOLUTION } from './platform-evolution.service';
import type { IPlatformEvolution } from './platform-evolution.service';

@Controller({ path: 'platform-evolution', version: '1' })
@UseGuards(JwtAuthGuard)
export class PlatformEvolutionController {
  constructor(@Inject(PLATFORM_EVOLUTION) private readonly ev: IPlatformEvolution) {}
  private t = (req: any) => req.user?.tenantId!;

  @Get('dashboard') dash(@Req() req: any) { return this.ev.dashboard(this.t(req)); }

  @Post('radar') addRadar(@Req() req: any, @Body() b: { name: string; category: string; maturity?: string }) { return this.ev.addRadarEntry(this.t(req), b.name, b.category, b.maturity); }
  @Get('radar') listRadar(@Req() req: any) { return this.ev.listRadar(this.t(req)); }

  @Post('benchmarks') addBenchmark(@Req() req: any, @Body() b: { modelName: string; provider: string; task: string; score: number }) { return this.ev.recordBenchmark(this.t(req), b.modelName, b.provider, b.task, b.score); }
  @Get('benchmarks') listBenchmarks(@Req() req: any) { return this.ev.listBenchmarks(this.t(req)); }

  @Post('experiments') createExp(@Req() req: any, @Body() b: { name: string; description?: string }) { return this.ev.createExperiment(this.t(req), b.name, b.description); }
  @Patch('experiments/:id/complete') completeExp(@Req() req: any, @Param('id') id: string, @Body() b: { results: Record<string,unknown> }) { return this.ev.completeExperiment(this.t(req), id, b.results ?? {}); }
  @Get('experiments') listExperiments(@Req() req: any) { return this.ev.listExperiments(this.t(req)); }

  @Post('features') addFeature(@Req() req: any, @Body() b: { name: string; state?: string }) { return this.ev.registerFeature(this.t(req), b.name, b.state); }
  @Patch('features/:id') advanceFeature(@Req() req: any, @Param('id') id: string, @Body() b: { state: string }) { return this.ev.advanceFeature(this.t(req), id, b.state); }
  @Get('features') listFeatures(@Req() req: any) { return this.ev.listFeatures(this.t(req)); }

  @Post('capabilities') versionCap(@Req() req: any, @Body() b: { domain: string; changes?: string[]; backwardCompatible?: boolean }) { return this.ev.versionCapability(this.t(req), b.domain, b.changes, b.backwardCompatible); }
  @Get('capabilities') listCaps(@Req() req: any) { return this.ev.listCapabilityVersions(this.t(req)); }

  @Post('migrations') createPlan(@Req() req: any, @Body() b: { name: string; targetType: string; steps?: string[]; riskLevel?: string }) { return this.ev.createMigrationPlan(this.t(req), b.name, b.targetType, b.steps, b.riskLevel); }
  @Get('migrations') listPlans(@Req() req: any) { return this.ev.listMigrationPlans(this.t(req)); }
}
