/**
 * MetricsService — Prometheus registry + typed metric helpers.
 *
 * Phase 5 pre-req (`EAOS-implementation-roadmap.md` §9, Phase 5
 * "Observability" bullet). Owns:
 *   - the global `prom-client` `Registry`
 *   - all AI-Action counters/histograms used by `AiActionMetricsInterceptor`
 *   - default Node.js process metrics (event loop lag, GC, memory)
 *   - the `recordAiAction(...)` typed helper
 *
 * SOLID: SRP — this service is the ONLY object that touches
 * `prom-client`. Consumers (`AiActionMetricsInterceptor`,
 * `MetricsController`) depend on this abstraction.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export type AiActionStatus = 'success' | 'failure' | 'timeout' | 'rate_limited';
export type AiActionErrorType =
  | 'timeout'
  | 'rate_limit'
  | 'upstream_4xx'
  | 'upstream_5xx'
  | 'validation'
  | 'auth'
  | 'internal';

export interface AiActionMetricLabels {
  tenantId: string;
  userId: string;
  actionId: string;
  model?: string;
}

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: Registry;

  // ── AI Action metrics ────────────────────────────────────────────────

  readonly aiActionInvocationsTotal: Counter<'status' | 'actionId'>;
  readonly aiActionDurationSeconds: Histogram<string>;
  readonly aiActionTokensTotal: Counter<'direction' | 'actionId'>;
  readonly aiActionCostUsdTotal: Counter<'model' | 'actionId'>;
  readonly aiActionErrorsTotal: Counter<'actionId' | 'errorType'>;

  constructor() {
    this.registry = new Registry();

    this.aiActionInvocationsTotal = new Counter({
      name: 'neurecore_ai_action_invocations_total',
      help: 'Total AI Action invocations, labelled by terminal status and action id',
      labelNames: ['status', 'actionId'] as const,
      registers: [this.registry],
    });

    // Latency histogram in seconds (Prometheus convention).
    // Buckets are tuned for LLM-backed actions: most complete 1-30s,
    // tail up to 2 minutes for big summarisations.
    this.aiActionDurationSeconds = new Histogram({
      name: 'neurecore_ai_action_duration_seconds',
      help: 'AI Action end-to-end duration in seconds',
      labelNames: ['actionId'] as const,
      buckets: [0.1, 0.5, 1, 2, 5, 10, 20, 30, 60, 120, 300],
      registers: [this.registry],
    });

    this.aiActionTokensTotal = new Counter({
      name: 'neurecore_ai_action_tokens_total',
      help: 'Total tokens consumed by AI Actions (input + output)',
      labelNames: ['direction', 'actionId'] as const,
      registers: [this.registry],
    });

    this.aiActionCostUsdTotal = new Counter({
      name: 'neurecore_ai_action_cost_usd_total',
      help: 'Total estimated USD cost of AI Action invocations',
      labelNames: ['model', 'actionId'] as const,
      registers: [this.registry],
    });

    this.aiActionErrorsTotal = new Counter({
      name: 'neurecore_ai_action_errors_total',
      help: 'AI Action errors by error type',
      labelNames: ['actionId', 'errorType'] as const,
      registers: [this.registry],
    });
  }

  onModuleInit(): void {
    // Collect Node.js default metrics (event loop lag, GC, memory, CPU).
    collectDefaultMetrics({
      register: this.registry,
      prefix: 'neurecore_node_',
    });
    this.logger.log(
      `MetricsService initialised — registry has ${this.registry.getMetricsAsArray().length} collectors`,
    );
  }

  /**
   * Record a single AI Action invocation's outcome.
   *
   * @param labels    tenantId / userId / actionId (model optional)
   * @param durationMs wall-clock duration in milliseconds
   * @param tokens    input + output token usage
   * @param costUsd   estimated cost (USD)
   * @param status    terminal status: success | failure | timeout | rate_limited
   * @param errorType optional classification when status !== success
   */
  recordAiAction(args: {
    labels: AiActionMetricLabels;
    durationMs: number;
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
    status: AiActionStatus;
    errorType?: AiActionErrorType;
  }): void {
    const { labels, durationMs, inputTokens, outputTokens, costUsd, status, errorType } = args;
    const model = labels.model ?? 'unknown';

    try {
      this.aiActionInvocationsTotal.inc({ status, actionId: labels.actionId });
      this.aiActionDurationSeconds.observe({ actionId: labels.actionId }, durationMs / 1000);

      if (inputTokens > 0) {
        this.aiActionTokensTotal.inc(
          { direction: 'input', actionId: labels.actionId },
          inputTokens,
        );
      }
      if (outputTokens > 0) {
        this.aiActionTokensTotal.inc(
          { direction: 'output', actionId: labels.actionId },
          outputTokens,
        );
      }
      if (costUsd > 0) {
        this.aiActionCostUsdTotal.inc(
          { model, actionId: labels.actionId },
          costUsd,
        );
      }

      if (status !== 'success' && errorType) {
        this.aiActionErrorsTotal.inc({ actionId: labels.actionId, errorType });
      }
    } catch (err) {
      // Metrics MUST NEVER break the calling code path.
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`recordAiAction failed (non-fatal): ${msg}`);
    }
  }

  /**
   * Serialise the registry into the Prometheus text exposition format.
   * Consumed by `MetricsController` (and by the Prometheus scraper on Contabo).
   */
  async toExpositionFormat(): Promise<string> {
    return this.registry.metrics();
  }

  /**
   * Content-Type header for the Prometheus exposition format.
   */
  get contentType(): string {
    return this.registry.contentType;
  }
}