import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { AnalyticsService } from '../services/analytics.service';
import { ScoreRequestDto } from '../dto/score-request.dto';
import { ForecastRequestDto } from '../dto/forecast-request.dto';
import { AnomalyRequestDto } from '../dto/anomaly-request.dto';
import { EmbedRequestDto } from '../dto/embed-request.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

@ApiCommon('analytics')
@Controller({ path: 'analytics', version: '1' })
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('models')
  getModels(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.analyticsService.getModels(user.tenantId);
  }

  @Get('report')
  getReport(@CurrentUser() user: JwtPayload) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.analyticsService.getReport(user.tenantId);
  }

  @Get('features')
  getFeatures(@CurrentUser() user: JwtPayload, @Query('limit') limit?: string) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.analyticsService.getFeatureHistory(user.tenantId, limit ? parseInt(limit, 10) : 50);
  }

  @Post('score')
  @HttpCode(HttpStatus.OK)
  score(@CurrentUser() user: JwtPayload, @Body() dto: ScoreRequestDto) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.analyticsService.score(user.tenantId, dto.features);
  }

  @Post('forecast')
  @HttpCode(HttpStatus.OK)
  forecast(@CurrentUser() user: JwtPayload, @Body() dto: ForecastRequestDto) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.analyticsService.forecast(user.tenantId, dto.periods ?? 30);
  }

  @Post('anomaly')
  @HttpCode(HttpStatus.OK)
  anomaly(@CurrentUser() user: JwtPayload, @Body() dto: AnomalyRequestDto) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.analyticsService.detectAnomalies(user.tenantId, dto.vectors);
  }

  @Post('embed')
  @HttpCode(HttpStatus.OK)
  embed(@CurrentUser() user: JwtPayload, @Body() dto: EmbedRequestDto) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.analyticsService.embed(user.tenantId, dto.texts);
  }
}
