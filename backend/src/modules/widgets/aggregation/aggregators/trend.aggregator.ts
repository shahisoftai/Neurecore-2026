import { Injectable } from '@nestjs/common';
import type { IAggregator } from './i-aggregator';
import type { AggregationType } from '../../widget-definition';

export type Trend = 'UP' | 'DOWN' | 'STABLE';

/**
 * TrendAggregator — compares the last two values to produce a direction.
 *
 * If the last value is > previous → UP; < previous → DOWN; equal → STABLE.
 * Returns `STABLE` for < 2 values (no trend computable).
 *
 * Stable threshold: if `|last - prev| < epsilon` (default 1e-6), the trend
 * is considered STABLE.
 */
@Injectable()
export class TrendAggregator implements IAggregator<Trend> {
  readonly type: AggregationType = 'TREND';

  compute(values: ReadonlyArray<number>): Trend | null {
    if (values.length < 2) return 'STABLE';
    const prev = values[values.length - 2];
    const last = values[values.length - 1];
    if (typeof prev !== 'number' || typeof last !== 'number') return 'STABLE';
    if (!Number.isFinite(prev) || !Number.isFinite(last)) return 'STABLE';
    const epsilon = 1e-6;
    const diff = last - prev;
    if (Math.abs(diff) < epsilon) return 'STABLE';
    return diff > 0 ? 'UP' : 'DOWN';
  }
}