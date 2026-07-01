/**
 * AggregationFactory — the Factory (Strategy-creator) for IAggregator.
 *
 * Phase 4 / EAOS-2. Returns the right strategy for a given
 * AggregationType. New aggregations are registered in the constructor
 * (one line) — no other file changes.
 *
 * SOLID: OCP + DIP. The engine depends on this factory (abstraction),
 * not on concrete aggregators (implementation).
 */

import { Injectable } from '@nestjs/common';
import type { IAggregator } from './aggregators/i-aggregator';
import { SumAggregator } from './aggregators/sum.aggregator';
import { AvgAggregator } from './aggregators/avg.aggregator';
import { CountAggregator } from './aggregators/count.aggregator';
import { MinAggregator } from './aggregators/min.aggregator';
import { MaxAggregator } from './aggregators/max.aggregator';
import { PercentageAggregator } from './aggregators/percentage.aggregator';
import { RatioAggregator } from './aggregators/ratio.aggregator';
import { TrendAggregator } from './aggregators/trend.aggregator';
import type { AggregationType } from '../widget-definition';

@Injectable()
export class AggregationFactory {
  private readonly strategies: Map<AggregationType, IAggregator<unknown>> = new Map();

  constructor(
    sum: SumAggregator,
    avg: AvgAggregator,
    count: CountAggregator,
    min: MinAggregator,
    max: MaxAggregator,
    percentage: PercentageAggregator,
    ratio: RatioAggregator,
    trend: TrendAggregator,
  ) {
    this.register(sum);
    this.register(avg);
    this.register(count);
    this.register(min);
    this.register(max);
    this.register(percentage);
    this.register(ratio);
    this.register(trend);
  }

  private register(aggregator: IAggregator<unknown>): void {
    this.strategies.set(aggregator.type, aggregator);
  }

  get(type: AggregationType): IAggregator<unknown> | undefined {
    return this.strategies.get(type);
  }

  has(type: AggregationType): boolean {
    return this.strategies.has(type);
  }

  /**
   * All registered aggregation types.
   */
  supportedTypes(): AggregationType[] {
    return Array.from(this.strategies.keys());
  }
}