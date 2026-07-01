import { Injectable } from '@nestjs/common';
import type { IAggregator } from './i-aggregator';
import type { AggregationType } from '../../widget-definition';

@Injectable()
export class CountAggregator implements IAggregator<number> {
  readonly type: AggregationType = 'COUNT';

  compute(values: ReadonlyArray<number>): number | null {
    return values.length;
  }
}