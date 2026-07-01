import { Module } from '@nestjs/common';
import { WidgetsController } from './widgets.controller';
import { WidgetsService } from './widgets.service';
import { WidgetRegistry } from './widget-registry';
import { AggregationEngine } from './aggregation/aggregation-engine';
import { AggregationFactory } from './aggregation/aggregation.factory';
import { SumAggregator } from './aggregation/aggregators/sum.aggregator';
import { AvgAggregator } from './aggregation/aggregators/avg.aggregator';
import { CountAggregator } from './aggregation/aggregators/count.aggregator';
import { MinAggregator } from './aggregation/aggregators/min.aggregator';
import { MaxAggregator } from './aggregation/aggregators/max.aggregator';
import { PercentageAggregator } from './aggregation/aggregators/percentage.aggregator';
import { RatioAggregator } from './aggregation/aggregators/ratio.aggregator';
import { TrendAggregator } from './aggregation/aggregators/trend.aggregator';

@Module({
  controllers: [WidgetsController],
  providers: [
    WidgetsService,
    WidgetRegistry,
    AggregationEngine,
    AggregationFactory,
    SumAggregator,
    AvgAggregator,
    CountAggregator,
    MinAggregator,
    MaxAggregator,
    PercentageAggregator,
    RatioAggregator,
    TrendAggregator,
  ],
  exports: [
    WidgetsService,
    WidgetRegistry,
    AggregationEngine,
  ],
})
export class WidgetsModule {}