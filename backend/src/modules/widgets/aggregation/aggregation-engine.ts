/**
 * AggregationEngine — the Context in the Strategy pattern.
 *
 * Phase 4 / EAOS-2. Given a `WidgetDefinition`, fetches the raw values,
 * delegates to the right `IAggregator`, and returns the result.
 *
 * Data fetching is intentionally pluggable: pass a `dataFetcher` callback
 * that pulls values from Prisma / external APIs / cache. The engine
 * itself never touches the DB (SRP — it only orchestrates).
 */

import { Injectable, Logger } from '@nestjs/common';
import type { WidgetDefinition } from '../widget-definition';
import { AggregationFactory } from './aggregation.factory';
import type { IAggregator } from './aggregators/i-aggregator';

export interface AggregationResult {
  widgetId: string;
  computation: string;
  aggregationType: WidgetDefinition['aggregationType'];
  value: number | string | null;
  rawCount: number;
  computedAt: string;
}

export type WidgetDataFetcher = (
  widget: WidgetDefinition,
  params?: Record<string, unknown>,
) => Promise<number[]>;

@Injectable()
export class AggregationEngine {
  private readonly logger = new Logger(AggregationEngine.name);

  constructor(private readonly factory: AggregationFactory) {}

  /**
   * Compute a single Widget's aggregate.
   *
   * @param widget    the Widget definition
   * @param fetcher   callback that returns the raw numeric values
   * @param params    aggregation params (e.g. percentage.total, timeRange)
   */
  async compute(
    widget: WidgetDefinition,
    fetcher: WidgetDataFetcher,
    params?: Record<string, unknown>,
  ): Promise<AggregationResult> {
    const aggregator: IAggregator<unknown> | undefined = this.factory.get(
      widget.aggregationType,
    );

    if (!aggregator) {
      this.logger.warn(
        `No aggregator for type=${widget.aggregationType}; returning null for widget=${widget.id}`,
      );
      return {
        widgetId: widget.id,
        computation: widget.computation,
        aggregationType: widget.aggregationType,
        value: null,
        rawCount: 0,
        computedAt: new Date().toISOString(),
      };
    }

    try {
      const values = await fetcher(widget, params);
      const result = aggregator.compute(values, params);
      const value: number | string | null =
        result === null || result === undefined
          ? null
          : typeof result === 'number' || typeof result === 'string'
            ? result
            : null;
      return {
        widgetId: widget.id,
        computation: widget.computation,
        aggregationType: widget.aggregationType,
        value,
        rawCount: values.length,
        computedAt: new Date().toISOString(),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Aggregation failed for widget=${widget.id}: ${msg}`,
      );
      return {
        widgetId: widget.id,
        computation: widget.computation,
        aggregationType: widget.aggregationType,
        value: null,
        rawCount: 0,
        computedAt: new Date().toISOString(),
      };
    }
  }

  /**
   * Compute a batch of widgets in parallel.
   */
  async computeBatch(
    widgets: ReadonlyArray<WidgetDefinition>,
    fetcher: WidgetDataFetcher,
    params?: Record<string, unknown>,
  ): Promise<AggregationResult[]> {
    return Promise.all(
      widgets.map((w) => this.compute(w, fetcher, params)),
    );
  }
}