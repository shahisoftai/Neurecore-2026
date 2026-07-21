import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { MetricType } from '@prisma/client';

interface BufferedWrite {
  name: string;
  type: 'COUNTER' | 'HISTOGRAM';
  value: number;
  labels: Record<string, unknown>;
  tenantId: string | null;
}

/**
 * WS-8: Lightweight telemetry for Section 10 success metrics.
 *
 * PERF-FIX: callers no longer `await` the per-event DB insert — instead
 * events are pushed onto an in-memory ring buffer and flushed in
 * `createMany` batches every 2 seconds. Cuts the per-request latency
 * cost of telemetry from ~30-80ms (one INSERT) to ~0ms (push to array).
 *
 * High-frequency paths should still sample — this is not a license to
 * spam events. Default buffer holds 1000 events; oldest are dropped if
 * the buffer fills before the next flush (better than back-pressure).
 */
@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly buffer: BufferedWrite[] = [];
  private readonly maxBuffer = 1000;
  private flushTimer: NodeJS.Timeout | null = null;
  private flushing = false;
  private droppedCount = 0;

  constructor(private readonly prisma: PrismaService) {}

  track(
    name: string,
    opts: { tenantId?: string; value?: number; labels?: Record<string, unknown> } = {},
  ): void {
    this.enqueue({
      name,
      type: 'COUNTER',
      value: opts.value ?? 1,
      labels: (opts.labels ?? {}) as Record<string, unknown>,
      tenantId: opts.tenantId ?? null,
    });
  }

  timing(
    name: string,
    durationMs: number,
    opts: { tenantId?: string; labels?: Record<string, unknown> } = {},
  ): void {
    this.enqueue({
      name,
      type: 'HISTOGRAM',
      value: durationMs,
      labels: (opts.labels ?? {}) as Record<string, unknown>,
      tenantId: opts.tenantId ?? null,
    });
  }

  /**
   * Backwards-compat shim: callers that previously `await`-ed track/timing
   * still get a Promise<void> they can `void` or `.catch()`. Internally
   * it's fire-and-forget.
   */
  async trackAsync(
    name: string,
    opts: { tenantId?: string; value?: number; labels?: Record<string, unknown> } = {},
  ): Promise<void> {
    this.track(name, opts);
  }

  async timingAsync(
    name: string,
    durationMs: number,
    opts: { tenantId?: string; labels?: Record<string, unknown> } = {},
  ): Promise<void> {
    this.timing(name, durationMs, opts);
  }

  private enqueue(write: BufferedWrite): void {
    if (this.buffer.length >= this.maxBuffer) {
      this.droppedCount += 1;
      return;
    }
    this.buffer.push(write);
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flushTimer = null;
        void this.flush();
      }, 2000);
    }
  }

  private async flush(): Promise<void> {
    if (this.flushing || this.buffer.length === 0) return;
    this.flushing = true;
    const batch = this.buffer.splice(0, this.buffer.length);
    const dropped = this.droppedCount;
    this.droppedCount = 0;
    try {
      await this.prisma.tenantMetric.createMany({
        data: batch.map((b) => ({
          name: b.name,
          type: b.type as MetricType,
          value: b.value,
          labels: b.labels as never,
          tenantId: b.tenantId,
        })),
      });
    } catch (err) {
      this.logger.warn(
        `Telemetry batch flush failed (${batch.length} events${dropped ? `, ${dropped} dropped` : ''}): ${(err as Error).message}`,
      );
    } finally {
      this.flushing = false;
      // If events piled up while we were flushing, schedule another pass.
      if (this.buffer.length > 0 && !this.flushTimer) {
        this.flushTimer = setTimeout(() => {
          this.flushTimer = null;
          void this.flush();
        }, 2000);
      }
    }
  }
}