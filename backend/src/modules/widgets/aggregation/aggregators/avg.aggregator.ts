import { Injectable } from '@nestjs/common';
import type { IAggregator } from './i-aggregator';
import type { AggregationType } from '../../widget-definition';

@Injectable()
export class AvgAggregator implements IAggregator<number> {
  readonly type: AggregationType = 'AVG';

  compute(values: ReadonlyArray<number>): number | null {
    if (values.length === 0) return null;
    let sum = 0;
    let count = 0;
    for (const v of values) {
      if (typeof v === 'number' && !Number.isNaN(v)) {
        sum += v;
        count += 1;
      }
    }
    if (count === 0) return null;
    return sum / count;
  }
}