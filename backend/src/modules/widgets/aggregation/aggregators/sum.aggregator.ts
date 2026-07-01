import { Injectable } from '@nestjs/common';
import type { IAggregator } from './i-aggregator';
import type { AggregationType } from '../../widget-definition';

@Injectable()
export class SumAggregator implements IAggregator<number> {
  readonly type: AggregationType = 'SUM';

  compute(values: ReadonlyArray<number>): number | null {
    if (values.length === 0) return null;
    let total = 0;
    for (const v of values) {
      if (typeof v === 'number' && !Number.isNaN(v)) total += v;
    }
    return total;
  }
}