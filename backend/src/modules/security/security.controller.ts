/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Controller - REST API Endpoints
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides security-related endpoints for monitoring and configuration.
 */

import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { ConfigService } from '@nestjs/config';
import type { Response, Request } from 'express';
import { SecurityEventSeverity } from '../../shared/types/security.types';
import { Throttle, SkipThrottle } from '@nestjs/throttler';

import { Public } from '../../common/decorators/roles.decorator';
import { RateLimitService } from './services/rate-limit.service';
import { SecurityEventService } from './services/security-event.service';
import { DataMaskingService } from './services/data-masking.service';

@SkipThrottle()
@Controller('security')
@ApiCommon('security')
export class SecurityController {
  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly securityEventService: SecurityEventService,
    private readonly dataMaskingService: DataMaskingService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get current security status
   */
  @Get('status')
  async getSecurityStatus() {
    return {
      securityEnabled: true,
      csrfEnabled: this.configService.get<boolean>('CSRF_ENABLED', true),
      rateLimitEnabled: true,
      helmetEnabled: this.configService.get<boolean>('HELMET_ENABLED', true),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get rate limit status for current user
   */
  @Get('rate-limit/status')
  async getRateLimitStatus(@Req() req: Request) {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req as any).ip ||
      'unknown';

    const status = await this.rateLimitService.getStatus(ip);
    return status;
  }

  /**
   * Get recent security events (admin only)
   */
  @Get('events')
  async getSecurityEvents(@Req() req: Request) {
    const events = await this.securityEventService.getRecentEvents(50);
    return {
      events: events.map((e) =>
        this.dataMaskingService.maskObject(
          e as unknown as Record<string, unknown>,
          ['ipAddress'],
        ),
      ),
      count: events.length,
    };
  }

  /**
   * Report a security concern
   */
  @Post('report')
  @HttpCode(HttpStatus.ACCEPTED)
  async reportSecurityConcern(
    @Body()
    body: {
      type: string;
      description: string;
      metadata?: Record<string, unknown>;
    },
    @Req() req: Request,
  ) {
    await this.securityEventService.logEvent({
      type: body.type as any,
      severity: SecurityEventSeverity.WARNING,
      message: body.description,
      ipAddress:
        (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
        (req as any).ip ||
        'unknown',
      userAgent: req.headers['user-agent'] || 'unknown',
      endpoint: req.url,
      method: req.method,
      metadata: body.metadata,
    });

    return { acknowledged: true };
  }

  /**
   * Validate input for potential XSS or SQL injection
   */
  @Post('validate-input')
  @HttpCode(HttpStatus.OK)
  async validateInput(@Body() body: { input: string }) {
    const sqlInjectionResult = await this.rateLimitService[
      'inputSanitizationService'
    ].detectSqlInjection(body.input);
    const xssResult = await this.rateLimitService[
      'inputSanitizationService'
    ].detectXss(body.input);

    return {
      safe: !sqlInjectionResult && !xssResult,
      sqlInjection: sqlInjectionResult,
      xss: xssResult,
    };
  }
}
