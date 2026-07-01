import {
  Controller,
  Get,
  Query,
  ForbiddenException,
  Header,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { ObservabilityService } from './services/observability.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';

@Controller({ path: 'observability', version: '1' })
@ApiCommon('observability')
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  /** Tenant KPI summary */
  @Get('kpis')
  getTenantKpis(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getTenantKpis(user.tenantId);
  }

  /** Execution logs for the tenant */
  @Get('logs')
  getExecutionLogs(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('agentId') agentId?: string,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getExecutionLogs(user.tenantId, {
      page: Number(page),
      limit: Number(limit),
      agentId,
    });
  }

  /** Metrics time-series */
  @Get('metrics')
  getMetrics(
    @CurrentUser() user: JwtPayload,
    @Query('name') name?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit = '100',
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getMetrics(user.tenantId, {
      name,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      limit: Number(limit),
    });
  }

  /**
   * GET /observability/traces — grouped step-by-step execution traces per task.
   */
  @Get('traces')
  getTraces(
    @CurrentUser() user: JwtPayload,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('agentId') agentId?: string,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getTraces(user.tenantId, {
      page: Number(page),
      limit: Number(limit),
      agentId,
    });
  }

  /**
   * GET /observability/costs — token/cost breakdown by agent.
   */
  @Get('costs')
  getCosts(
    @CurrentUser() user: JwtPayload,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    if (!user.tenantId) throw new ForbiddenException('Tenant context required');
    return this.observabilityService.getCosts(user.tenantId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  /**
   * GET /observability/prometheus — Prometheus text-format metrics scrape endpoint.
   * Tenant-scoped for regular users; platform-wide for Super Admin.
   */
  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getPrometheus(@CurrentUser() user: JwtPayload): Promise<string> {
    const tenantId = ['SUPER_ADMIN', 'PLATFORM_ADMIN'].includes(user.role ?? '')
      ? undefined
      : (user.tenantId ?? undefined);
    return this.observabilityService.getPrometheusMetrics(tenantId);
  }

  /** Platform-wide summary — Super Admin only */
  @Get('platform')
  @Roles('SUPER_ADMIN', 'PLATFORM_ADMIN')
  getPlatformSummary() {
    return this.observabilityService.getPlatformSummary();
  }
}
