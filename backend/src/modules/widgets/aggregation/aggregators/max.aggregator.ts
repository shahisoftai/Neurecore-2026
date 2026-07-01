import { Injectable } from '@nestjs/common';
import type { IAggregator } from './i-aggregator';
import type { AggregationType } from '../../widget-definition';

@Injectable()
export class MaxAggregator implements IAggregator<number> {
  readonly type: AggregationType = 'MAX';

  compute(values: ReadonlyArray<number>): number | null {
    if (values.length === 0) return null;
    let max = Number.NEGATIVE_INFINITY;
    for (const v of values) {
      if (typeof v === 'number' && !Number.isNaN(v) && v > max) max = v;
    }
    return max === Number.NEGATIVE_INFINITY ? null : max;
  }
}