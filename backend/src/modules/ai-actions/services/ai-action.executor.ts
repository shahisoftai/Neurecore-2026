/**
 * AIActionExecutor — runs a registered AI Action handler against the
 * typed context, in either sync or streaming mode.
 *
 * Per `EAOS-implementation-plan.md` §4.6 (AI Action Registry) +
 * `EAOS-api-contract.md` §13.2 (invocation lifecycle).
 *
 * Responsibilities:
 *   1. Resolve the handler from the registry.
 *   2. Drive either a Promise-based (sync) or AsyncGenerator-based
 *      (streaming) handler, emitting stream chunks for streaming actions.
 *   3. Enforce `definition.timeoutMs` (AbortController-backed).
 *   4. Catch handler exceptions and translate them into a FAILED
 *      `AIActionInvocation` row.
 *
 * NOT responsible for:
 *   - Authorization (ActionAuthorizationGuard does that).
 *   - Persistence (AIActionsService writes the invocation row).
 *   - Metrics (AiActionMetricsInterceptor records to Prometheus).
 *
 * SOLID: SRP — this file only orchestrates handler execution.
 */

import { Injectable, Logger } from '@nestjs/common';
import type {
  AIActionContext,
  AIActionDefinition,
  AIActionResult,
  AIActionStreamChunk,
} from '../action-definition';
import { AIActionRegistry } from '../ai-action.registry';
import { AIActionStreamingService } from './ai-action-streaming.service';

export interface ExecuteOutcome {
  status: 'completed' | 'failed' | 'cancelled';
  result?: AIActionResult;
  error?: string;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCostUsd: number;
  model?: string;
}

@Injectable()
export class AIActionExecutor {
  private readonly logger = new Logger(AIActionExecutor.name);

  constructor(
    private readonly registry: AIActionRegistry,
    private readonly streaming: AIActionStreamingService,
  ) {}

  /**
   * Execute the action bound to `actionId`. Returns a normalised outcome
   * suitable for persisting into `AIActionInvocation`.
   *
   * If the action has `requiresStreaming === true`, this method emits
   * stream chunks to the registered SSE subject for `invocationId`
   * (when provided), AND still returns the final outcome synchronously
   * for the polling path (`GET /ai-actions/:id`).
   */
  async execute(args: {
    actionId: string;
    context: AIActionContext;
    invocationId?: string;
  }): Promise<ExecuteOutcome> {
    const def = this.registry.getById(args.actionId);
    if (!def) {
      return this.failure('AI_ACTION_NOT_FOUND', args.actionId, 0);
    }

    const startedAt = Date.now();
    const ac = new AbortController();
    const ctx: AIActionContext = { ...args.context, signal: ac.signal };

    // Set up a timeout that aborts the handler.
    const timer = setTimeout(() => ac.abort('timeout'), def.timeoutMs);

    try {
      const handlerResult = def.handler(ctx);

      if (isAsyncGenerator(handlerResult)) {
        return await this.runStreaming(
          def,
          handlerResult,
          args.invocationId,
          startedAt,
        );
      }
      return await this.runSync(def, handlerResult, startedAt);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const cancelled = ac.signal.aborted;
      this.logger.warn(
        `[${args.actionId}] ${cancelled ? 'cancelled' : 'failed'}: ${msg}`,
      );
      if (args.invocationId) {
        this.streaming.emit(args.invocationId, {
          type: cancelled ? 'cancelled' : 'error',
          invocationId: args.invocationId,
          timestamp: Date.now(),
          error: msg,
        } as never);
      }
      return {
        status: cancelled ? 'cancelled' : 'failed',
        error: msg,
        durationMs: Date.now() - startedAt,
        inputTokens: 0,
        outputTokens: 0,
        totalTokens: 0,
        estimatedCostUsd: 0,
      };
    } finally {
      clearTimeout(timer);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────

  private async runSync(
    def: AIActionDefinition,
    promise: Promise<AIActionResult>,
    startedAt: number,
  ): Promise<ExecuteOutcome> {
    const result = await promise;
    return this.toOutcome(def, result, Date.now() - startedAt);
  }

  private async runStreaming(
    def: AIActionDefinition,
    gen: AsyncGenerator<AIActionStreamChunk>,
    invocationId: string | undefined,
    startedAt: number,
  ): Promise<ExecuteOutcome> {
    let final: AIActionResult | undefined;
    let lastError: string | undefined;

    for await (const chunk of gen) {
      if (invocationId) {
        this.streaming.emitChunk(invocationId, chunk);
      }
      if (chunk.type === 'done' && chunk.result) {
        final = chunk.result;
      } else if (chunk.type === 'error') {
        lastError = chunk.error;
      }
    }

    const durationMs = Date.now() - startedAt;
    if (final) {
      return this.toOutcome(def, final, durationMs);
    }
    return {
      status: lastError ? 'failed' : 'completed',
      error: lastError,
      durationMs,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };
  }

  private toOutcome(
    def: AIActionDefinition,
    result: AIActionResult,
    durationMs: number,
  ): ExecuteOutcome {
    const totalTokens = result.tokensUsed?.total ?? 0;
    const inputTokens = result.tokensUsed?.input ?? 0;
    const outputTokens = result.tokensUsed?.output ?? 0;
    return {
      status: 'completed',
      result,
      durationMs,
      inputTokens,
      outputTokens,
      totalTokens: totalTokens > 0 ? totalTokens : inputTokens + outputTokens,
      estimatedCostUsd: result.estimatedCostUsd ?? 0,
      model: result.model,
    };
  }

  private failure(
    _code: string,
    _actionId: string,
    _startedAt: number,
  ): ExecuteOutcome {
    return {
      status: 'failed',
      error: 'AI Action not found',
      durationMs: 0,
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCostUsd: 0,
    };
  }
}

function isAsyncGenerator(
  x: unknown,
): x is AsyncGenerator<AIActionStreamChunk> {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as { next?: unknown }).next === 'function' &&
    typeof (x as { return?: unknown }).return === 'function' &&
    typeof (x as { throw?: unknown }).throw === 'function' &&
    Symbol.asyncIterator in x
  );
}
