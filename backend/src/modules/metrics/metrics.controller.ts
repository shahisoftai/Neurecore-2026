/**
 * MetricsController — exposes `GET /metrics` in the Prometheus exposition format.
 *
 * Phase 5 pre-req. Per `EAOS-implementation-roadmap.md` §9 (Phase 5
 * Observability), the backend must publish AI-Action metrics for
 * Prometheus to scrape. This controller is `@Public()` so the
 * Prometheus scraper (running on the same Contabo host, no JWT) can
 * reach it without authentication.
 *
 * Path: `GET /metrics` (NestJS does NOT prefix this — it's a top-level
 * route, matching the convention Prometheus expects).
 */

import { Controller, Get, Header, Res } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { Response } from 'express';
import { Public } from '../../common/decorators/roles.decorator';
import { MetricsService } from './metrics.service';

@ApiExcludeController()
@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Get()
  @Header('Cache-Control', 'no-store')
  async scrape(@Res() res: Response): Promise<void> {
    const body = await this.metrics.toExpositionFormat();
    res.setHeader('Content-Type', this.metrics.contentType);
    res.status(200).send(body);
  }
}