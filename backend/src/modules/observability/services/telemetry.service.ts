import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MetricType } from '@prisma/client';

/**
 * WS-8: Lightweight telemetry for Section 10 success metrics.
 *
 * Writes counter events to the existing TenantMetric table. Use sparingly —
 * high-frequency paths should batch or sample.
 */
@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(private readonly prisma: PrismaService) {}

  async track(
    name: string,
    opts: { tenantId?: string; value?: number; labels?: Record<string, unknown> } = {},
  ): Promise<void> {
    try {
      await this.prisma.tenantMetric.create({
        data: {
          name,
          type: MetricType.COUNTER,
          value: opts.value ?? 1,
          labels: (opts.labels ?? {}) as never,
          tenantId: opts.tenantId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Telemetry write failed for ${name}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }

  async timing(
    name: string,
    durationMs: number,
    opts: { tenantId?: string; labels?: Record<string, unknown> } = {},
  ): Promise<void> {
    try {
      await this.prisma.tenantMetric.create({
        data: {
          name,
          type: MetricType.HISTOGRAM,
          value: durationMs,
          labels: (opts.labels ?? {}) as never,
          tenantId: opts.tenantId ?? null,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Telemetry timing failed for ${name}: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    }
  }
}