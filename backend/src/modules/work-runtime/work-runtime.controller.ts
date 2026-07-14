/**
 * Work Runtime API (Phase 4 §15). Tenant + actor derived from JWT (no
 * impersonation by query param). Traces are redacted (no raw tool inputs/results
 * beyond safe status). Cross-tenant lookups return not-found (no existence leak).
 */

import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UseGuards,
  ForbiddenException,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { WORK_RUNTIME, TOOL_REGISTRY } from './contracts/work-runtime.interface';
import type { IWorkRuntime, IToolRegistry } from './contracts/work-runtime.interface';

interface RequestWithUser {
  user?: { tenantId?: string; sub?: string; id?: string };
}

@Controller({ path: 'work-runtime', version: '1' })
@UseGuards(JwtAuthGuard)
export class WorkRuntimeController {
  constructor(
    @Inject(WORK_RUNTIME) private readonly runtime: IWorkRuntime,
    @Inject(TOOL_REGISTRY) private readonly tools: IToolRegistry,
  ) {}

  private ctx(req: RequestWithUser): { tenantId: string; actorId: string } {
    const tenantId = req.user?.tenantId;
    const actorId = req.user?.sub ?? req.user?.id;
    if (!tenantId || !actorId) throw new ForbiddenException('tenant + actor required');
    return { tenantId, actorId };
  }

  /** Create AND execute a run (executes until completion or approval pause). */
  @Post('runs')
  async createRun(
    @Req() req: RequestWithUser,
    @Body() body: { request: string; projectId?: string; customerId?: string; includeCapabilities?: string[] },
  ) {
    const { tenantId, actorId } = this.ctx(req);
    const created = await this.runtime.createRun({
      tenantId,
      actorId,
      actorType: 'HUMAN',
      request: body.request,
      scope: {
        projectId: body.projectId,
        customerId: body.customerId,
        includeCapabilities: body.includeCapabilities,
      },
    });
    const run = await this.runtime.execute(created.id, tenantId);
    return run;
  }

  @Get('runs/:id')
  async getRun(@Req() req: RequestWithUser, @Param('id') id: string) {
    const { tenantId } = this.ctx(req);
    const run = await this.runtime.getRun(id, tenantId);
    if (!run) throw new NotFoundException('run not found'); // no cross-tenant leak
    return run;
  }

  @Get('runs/:id/steps')
  async getSteps(@Req() req: RequestWithUser, @Param('id') id: string) {
    const { tenantId } = this.ctx(req);
    const run = await this.runtime.getRun(id, tenantId);
    if (!run) throw new NotFoundException('run not found');
    return this.runtime.getSteps(id, tenantId);
  }

  @Post('runs/:id/resume')
  async resume(@Req() req: RequestWithUser, @Param('id') id: string) {
    const { tenantId } = this.ctx(req);
    const run = await this.runtime.getRun(id, tenantId);
    if (!run) throw new NotFoundException('run not found');
    return this.runtime.resume(id, tenantId);
  }

  @Post('runs/:id/cancel')
  async cancel(
    @Req() req: RequestWithUser,
    @Param('id') id: string,
    @Body() body: { reason?: string },
  ) {
    const { tenantId } = this.ctx(req);
    const run = await this.runtime.getRun(id, tenantId);
    if (!run) throw new NotFoundException('run not found');
    return this.runtime.cancel(id, tenantId, body.reason ?? 'cancelled by user');
  }

  @Get('tools')
  listTools(@Req() req: RequestWithUser) {
    this.ctx(req);
    return { tools: this.tools.list() };
  }

  @Get('health')
  health(@Req() req: RequestWithUser) {
    this.ctx(req);
    return { status: 'ok', registeredTools: this.tools.list().length };
  }
}
