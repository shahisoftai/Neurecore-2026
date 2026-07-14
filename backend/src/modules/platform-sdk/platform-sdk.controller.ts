/**
 * Platform SDK API (Phase 10). Plugin registry, lifecycle, permissions,
 * version check. Tenant-scoped. Extensions are governed.
 */

import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards, ForbiddenException, Inject } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PLATFORM_SDK } from './contracts/platform-sdk.interface';
import type { ExtensionKind, IPlatformSDK } from './contracts/platform-sdk.interface';

interface ReqWithUser { user?: { tenantId?: string; sub?: string } }

@Controller({ path: 'platform-sdk', version: '1' })
@UseGuards(JwtAuthGuard)
export class PlatformSDKController {
  constructor(@Inject(PLATFORM_SDK) private readonly sdk: IPlatformSDK) {}
  private t = (req: ReqWithUser) => req.user?.tenantId!;

  @Get('extensions') list(@Req() req: ReqWithUser) { return this.sdk.listExtensions(this.t(req)); }
  @Post('extensions') install(@Req() req: ReqWithUser, @Body() b: { name: string; kind: ExtensionKind; permissions?: string[] }) { return this.sdk.installAndValidate(this.t(req), b.name, b.kind, b.permissions); }
  @Get('extensions/:id') get(@Req() req: ReqWithUser, @Param('id') id: string) { return this.sdk.plugins().get(id, this.t(req)); }
  @Patch('extensions/:id/enable') enable(@Req() req: ReqWithUser, @Param('id') id: string) { return this.sdk.plugins().enable(id, this.t(req)); }
  @Patch('extensions/:id/disable') disable(@Req() req: ReqWithUser, @Param('id') id: string) { return this.sdk.plugins().disable(id, this.t(req)); }
  @Get('extensions/:id/permissions') permissions(@Req() req: ReqWithUser, @Param('id') id: string) { return this.sdk.permissions().list(this.t(req), id); }
  @Get('version-check') versionCheck(@Body('sdkVersion') v: string) { return this.sdk.checkVersion(v ?? '10.0.0'); }
}
