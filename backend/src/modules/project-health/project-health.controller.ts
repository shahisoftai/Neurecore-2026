/**
 * project-health module — REST API Controller
 *
 * Phase 6: Health Score + BI Dashboards
 * SOLID: Thin controller — delegates to ProjectHealthService.
 */

import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ProjectHealthService } from './project-health.service';
import { ProjectHealthAIService } from './project-health-ai.service';
import { ComputeHealthDto, GetAnalyticsDto } from './dto/project-health.dto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { ProjectHealth, AnalyticsRollup, Bottleneck } from './interfaces/project-health.interface';

@ApiCommon('project-health')
@Controller({ path: 'project-health', version: '1' })
@UseGuards(JwtAuthGuard)
export class ProjectHealthController {
  constructor(
    private readonly healthService: ProjectHealthService,
    private readonly healthAiService: ProjectHealthAIService,
  ) {}

  @Get('project/:projectId')
  async getHealth(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
  ): Promise<ProjectHealth | null> {
    return this.healthService.getHealth(projectId, user.tenantId ?? '');
  }

  @Post('project/:projectId/recalculate')
  @HttpCode(HttpStatus.OK)
  async recalculateHealth(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
  ): Promise<ProjectHealth> {
    return this.healthService.recalculateHealth(projectId, user.tenantId ?? '');
  }

  @Get('at-risk')
  async getAtRiskProjects(
    @CurrentUser() user: JwtPayload,
    @Query('threshold') threshold?: string,
  ): Promise<ProjectHealth[]> {
    return this.healthService.getAtRiskProjects(
      user.tenantId ?? '',
      threshold ? Number(threshold) : 60,
    );
  }

  @Get('analytics')
  async getAnalytics(
    @CurrentUser() user: JwtPayload,
    @Query() query: GetAnalyticsDto,
  ): Promise<AnalyticsRollup> {
    return this.healthService.getAnalytics(user.tenantId ?? '', query.period ?? '30d');
  }

  @Get('bottlenecks')
  async getBottlenecks(@CurrentUser() user: JwtPayload): Promise<Bottleneck[]> {
    return this.healthService.detectBottlenecks(user.tenantId ?? '');
  }

  @Post('project/:projectId/calculate-ai')
  @HttpCode(HttpStatus.OK)
  async calculateAIHealth(
    @CurrentUser() user: JwtPayload,
    @Param('projectId') projectId: string,
  ) {
    return this.healthAiService.calculateWithAI(projectId, user.tenantId ?? '');
  }
}
