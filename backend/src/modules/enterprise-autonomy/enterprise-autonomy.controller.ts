/**
 * Enterprise Autonomy API (Phase 6). Tenant + actor from JWT. Missions (create/
 * get/list), observation cycle, human oversight (pause/cancel/prioritize),
 * enterprise health, employees/departments read, KPI/OKR/balancer read.
 */

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
  ForbiddenException,
  Inject,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  ENTERPRISE_AUTONOMY,
  AI_EMPLOYEE_MANAGER,
  AI_DEPARTMENT_MANAGER,
  KPI_MONITOR,
  OKR_MONITOR,
  WORKLOAD_BALANCER,
  ENTERPRISE_HEALTH,
} from './contracts/enterprise-autonomy.interface';
import type {
  IEnterpriseAutonomy,
  IAIEmployeeManager,
  IAIDepartmentManager,
  IKpiMonitor,
  IOkrMonitor,
  IWorkloadBalancer,
  IEnterpriseHealthService,
} from './contracts/enterprise-autonomy.interface';

interface RequestWithUser { user?: { tenantId?: string; sub?: string; id?: string } }

@Controller({ path: 'enterprise-autonomy', version: '1' })
@UseGuards(JwtAuthGuard)
export class EnterpriseAutonomyController {
  constructor(
    @Inject(ENTERPRISE_AUTONOMY) private readonly autonomy: IEnterpriseAutonomy,
    @Inject(AI_EMPLOYEE_MANAGER) private readonly employees: IAIEmployeeManager,
    @Inject(AI_DEPARTMENT_MANAGER) private readonly departments: IAIDepartmentManager,
    @Inject(KPI_MONITOR) private readonly kpiMonitor: IKpiMonitor,
    @Inject(OKR_MONITOR) private readonly okrMonitor: IOkrMonitor,
    @Inject(WORKLOAD_BALANCER) private readonly balancer: IWorkloadBalancer,
    @Inject(ENTERPRISE_HEALTH) private readonly healthService: IEnterpriseHealthService,
  ) {}
  private ctx(req: RequestWithUser) {
    const t = req.user?.tenantId; const a = req.user?.sub ?? req.user?.id;
    if (!t || !a) throw new ForbiddenException('tenant + actor required');
    return { tenantId: t, actorId: a };
  }

  @Post('missions') createMission(@Req() req: RequestWithUser, @Body() b: any) {
    const { tenantId, actorId } = this.ctx(req);
    // Audit-remediation: human-initiated missions stay HUMAN; AI-issued
    // missions (system actor with explicit body.actorType) can override.
    // Whatever is in b.actorType is ignored if it would let a client spoof
    // an AI_SYSTEM persona; the service applies its own defaults.
    const explicitActorType = b?.actorType;
    const safeActorType =
      explicitActorType === 'AI_AGENT' || explicitActorType === 'SYSTEM'
        ? 'SYSTEM' // collapse arbitrary AI/SYSTEM spoofing back to SYSTEM
        : 'HUMAN';
    return this.autonomy.createMission({
      ...b,
      tenantId,
      createdById: actorId,
      actorType: safeActorType,
    });
  }
  @Get('missions') listMissions(@Req() req: RequestWithUser) { return this.autonomy.listMissions(this.ctx(req).tenantId); }
  @Get('missions/:id') getMission(@Req() req: RequestWithUser, @Param('id') id: string) { return this.autonomy.getMission(id, this.ctx(req).tenantId); }
  @Patch('missions/:id/override') humanOverride(@Req() req: RequestWithUser, @Param('id') id: string, @Body() b: any) {
    const { tenantId, actorId } = this.ctx(req);
    return this.autonomy.humanOverride(id, tenantId, actorId, b.action, b.detail);
  }

  @Post('observe') observe(@Req() req: RequestWithUser, @Body() b: any) {
    return this.autonomy.runObservationCycle(this.ctx(req).tenantId, this.ctx(req).actorId, b);
  }

  @Get('employees') listEmployees(@Req() req: RequestWithUser) { return this.employees.list(this.ctx(req).tenantId); }
  @Get('departments') listDepartments(@Req() req: RequestWithUser) { return this.departments.list(this.ctx(req).tenantId); }

  @Get('health') healthEndpoint(@Req() req: RequestWithUser) { return this.healthService.compute(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('kpi') kpiEndpoint(@Req() req: RequestWithUser) { return this.kpiMonitor.snapshot(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('okr') okrEndpoint(@Req() req: RequestWithUser) { return this.okrMonitor.progress(this.ctx(req).tenantId, this.ctx(req).actorId); }
  @Get('workload') workload(@Req() req: RequestWithUser) { return this.balancer.recommend(this.ctx(req).tenantId); }
}
