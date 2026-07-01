import { Injectable } from '@nestjs/common';
import type { IAggregator } from './i-aggregator';
import type { AggregationType } from '../../widget-definition';

/**
 * RatioAggregator — computes (numerator / denominator).
 *
 * Expected input: exactly 2 values, [numerator, denominator].
 * Returns `null` if denominator is 0 / NaN / non-finite.
 */
@Injectable()
export class RatioAggregator implements IAggregator<number> {
  readonly type: AggregationType = 'RATIO';

  compute(values: ReadonlyArray<number>): number | null {
    if (values.length < 2) return null;
    const [num, den] = values;
    if (
      typeof num !== 'number' ||
      typeof den !== 'number' ||
      !Number.isFinite(num) ||
      !Number.isFinite(den) ||
      den === 0
    ) {
      return null;
    }
    return num / den;
  }
}