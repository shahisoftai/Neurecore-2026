import { Injectable } from '@nestjs/common';
import type { IAggregator } from './i-aggregator';
import type { AggregationType } from '../../widget-definition';

@Injectable()
export class MinAggregator implements IAggregator<number> {
  readonly type: AggregationType = 'MIN';

  compute(values: ReadonlyArray<number>): number | null {
    if (values.length === 0) return null;
    let min = Number.POSITIVE_INFINITY;
    for (const v of values) {
      if (typeof v === 'number' && !Number.isNaN(v) && v < min) min = v;
    }
    return min === Number.POSITIVE_INFINITY ? null : min;
  }
}