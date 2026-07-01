import { Injectable } from '@nestjs/common';
import type { IAggregator } from './i-aggregator';
import type { AggregationType } from '../../widget-definition';

/**
 * PercentageAggregator — computes (sum / total) * 100 from `params.total`.
 *
 * Expected params:
 *   total: number — the denominator (e.g. budget cap, target).
 *
 * Falls back to 0 when total is missing, non-positive, or NaN — the UI
 * interprets 0% as "no data" rather than crashing.
 */
@Injectable()
export class PercentageAggregator implements IAggregator<number> {
  readonly type: AggregationType = 'PERCENTAGE';

  compute(
    values: ReadonlyArray<number>,
    params?: Record<string, unknown>,
  ): number | null {
    const total = Number(params?.total);
    if (!Number.isFinite(total) || total <= 0) return 0;
    const sum = values.reduce<number>((acc, v) => {
      if (typeof v === 'number' && !Number.isNaN(v)) return acc + v;
      return acc;
    }, 0);
    return (sum / total) * 100;
  }
}