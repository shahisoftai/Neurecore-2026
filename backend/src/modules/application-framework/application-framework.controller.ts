/**
 * Application Framework API (Phase 12). Applications, domain packages,
 * industry solutions, workspaces, catalog. Tenant-scoped.
 */

import { Body, Controller, Get, Param, Post, Req, UseGuards, ForbiddenException, Inject, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { APP_FRAMEWORK } from './application-framework.service';
import type { IApplicationFramework } from './application-framework.service';

interface ReqWithUser { user?: { tenantId?: string; sub?: string } }

@Controller({ path: 'application-framework', version: '1' })
@UseGuards(JwtAuthGuard)
export class ApplicationFrameworkController {
  constructor(@Inject(APP_FRAMEWORK) private readonly fw: IApplicationFramework) {}
  private t = (req: ReqWithUser) => req.user?.tenantId!;

  @Get('catalog') catalog(@Req() req: ReqWithUser) { return this.fw.catalog(this.t(req)); }
  @Post('apps') addApp(@Req() req: ReqWithUser, @Body() b: { name: string; domain: string }) { return this.fw.registerApp(this.t(req), b.name, b.domain); }
  @Get('apps') listApps(@Req() req: ReqWithUser, @Query('domain') domain?: string) { return this.fw.listApps(this.t(req), domain); }
  @Post('apps/:id/activate') activate(@Req() req: ReqWithUser, @Param('id') id: string) { return this.fw.activate(this.t(req), id); }
  @Post('domains') addDomain(@Req() req: ReqWithUser, @Body() b: { name: string; domain: string; modules?: string[] }) { return this.fw.registerDomain(this.t(req), b.name, b.domain, b.modules); }
  @Get('domains') listDomains(@Req() req: ReqWithUser) { return this.fw.listDomains(this.t(req)); }
  @Post('solutions') addSolution(@Req() req: ReqWithUser, @Body() b: { name: string; industry: string; packages?: string[] }) { return this.fw.registerSolution(this.t(req), b.name, b.industry, b.packages); }
  @Get('solutions') listSolutions(@Req() req: ReqWithUser) { return this.fw.listSolutions(this.t(req)); }
  @Post('workspaces') addWorkspace(@Req() req: ReqWithUser, @Body() b: { name: string; role: string; dashboards?: string[] }) { return this.fw.createWorkspace(this.t(req), b.name, b.role, b.dashboards); }
  @Get('workspaces') listWorkspaces(@Req() req: ReqWithUser) { return this.fw.listWorkspaces(this.t(req)); }
}
