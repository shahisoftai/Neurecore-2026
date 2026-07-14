/**
 * Cloud Platform API (Phase 11). Regions, clusters, tenant placement,
 * routing, failover, global health. Read-control-plane — actual multi-region
 * infrastructure (K8s, DNS) is cloud operations. Tenant-scoped.
 */

import { Body, Controller, Get, Param, Post, Req, UseGuards, ForbiddenException, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CLOUD_PLATFORM } from './contracts/cloud-platform.interface';
import type { ICloudPlatform } from './contracts/cloud-platform.interface';

interface ReqWithUser { user?: { tenantId?: string; sub?: string } }

@Controller({ path: 'cloud-platform', version: '1' })
@UseGuards(JwtAuthGuard)
export class CloudPlatformController {
  constructor(@Inject(CLOUD_PLATFORM) private readonly cloud: ICloudPlatform) {}
  private t = (req: ReqWithUser) => req.user?.tenantId!;

  @Get('regions') regions(@Req() req: ReqWithUser) { return this.cloud.listRegions(this.t(req)); }
  @Post('regions') addRegion(@Req() req: ReqWithUser, @Body() b: { name: string; endpoint: string }) { return this.cloud.registerRegion(this.t(req), b.name, b.endpoint); }
  @Post('clusters') addCluster(@Req() req: ReqWithUser, @Body() b: { regionId: string; name: string; endpoint?: string }) { return this.cloud.registerCluster(b.regionId, b.name, b.endpoint); }
  @Post('place') place(@Req() req: ReqWithUser, @Body() b: { primary: string; backup?: string; residency?: string }) { return this.cloud.place(this.t(req), b.primary, b.backup, b.residency); }
  @Get('route') route(@Req() req: ReqWithUser) { return this.cloud.route(this.t(req)); }
  @Post('failover') failover(@Req() req: ReqWithUser, @Body() b: { target: string }) { return this.cloud.failover(this.t(req), b.target); }
  @Get('global-health') globalHealth(@Req() req: ReqWithUser) { return this.cloud.globalHealth(this.t(req)); }
}
