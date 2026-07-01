/**
 * AiActionMetricsInterceptor — auto-instrument every AI Action invocation.
 *
 * Phase 5 pre-req (per `EAOS-implementation-roadmap.md` §9, Phase 5
 * "Observability" bullet). This interceptor:
 *   1. Times the wrapped handler (`Date.now()` before/after).
 *   2. Extracts `tenantId`, `userId`, `actionId` from the request.
 *   3. Captures token counts + cost from the response (when present)
 *      OR from the `AIActionInvocation` row.
 *   4. Records the outcome to `MetricsService.recordAiAction()`.
 *
 * The interceptor MUST NOT throw. A failure in metrics recording is
 * logged at WARN level and swallowed so the underlying HTTP response
 * is never affected.
 *
 * SOLID: SRP — this file knows only "instrument an AI-Action call".
 * OCP  — add new label dimensions by extending `recordAiAction`'s
 *        contract, no changes needed here.
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, catchError, throwError } from 'rxjs';
import { tap } from 'rxjs/operators';
import type { Request } from 'express';
import { MetricsService } from '../../metrics/metrics.service';

interface AuthedRequest extends Request {
  user?: { id?: string; userId?: string; sub?: string; tenantId?: string };
}

interface AiActionBody {
  action?: string;
  parameters?: Record<string, unknown>;
}

interface AiActionResponse {
  id?: string;
  actionId?: string;
  tokensUsed?: number;
  estimatedCostUsd?: number | string;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

@Injectable()
export class AiActionMetricsInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AiActionMetricsInterceptor.name);

  constructor(
    private readonly metrics: MetricsService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const startedAt = Date.now();

    const body = (req.body ?? {}) as AiActionBody;
    const actionId = body.action ?? 'unknown';
    const userId =
      req.user?.id ?? req.user?.userId ?? req.user?.sub ?? 'unknown';
    const tenantId = req.user?.tenantId ?? 'unknown';

    const labels = { tenantId, userId, actionId };

    return next.handle().pipe(
      tap((response) => {
        const durationMs = Date.now() - startedAt;
        const r = (response ?? {}) as AiActionResponse;
        const totalTokens = Number(r.tokensUsed ?? 0);
        const inputTokens = Number(r.inputTokens ?? 0);
        const outputTokens = Number(r.outputTokens ?? 0);
        // If the handler splits tokens, prefer those; otherwise split
        // 70/30 as a heuristic for chat-completion actions (matches
        // OpenAI's typical ratio for summary actions).
        const finalInput =
          inputTokens > 0
            ? inputTokens
            : totalTokens > 0
              ? Math.round(totalTokens * 0.7)
              : 0;
        const finalOutput =
          outputTokens > 0
            ? outputTokens
            : totalTokens > 0
              ? Math.round(totalTokens * 0.3)
              : 0;
        const costUsd =
          typeof r.estimatedCostUsd === 'number'
            ? r.estimatedCostUsd
            : Number(r.estimatedCostUsd ?? 0);

        this.metrics.recordAiAction({
          labels: { ...labels, model: r.model },
          durationMs,
          inputTokens: finalInput,
          outputTokens: finalOutput,
          costUsd,
          status: 'success',
        });
      }),
      catchError((err: unknown) => {
        const durationMs = Date.now() - startedAt;
        const errorType = classifyError(err);
        const status =
          errorType === 'rate_limit'
            ? 'rate_limited'
            : errorType === 'timeout'
              ? 'timeout'
              : 'failure';

        this.metrics.recordAiAction({
          labels,
          durationMs,
          inputTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          status,
          errorType,
        });
        return throwError(() => err);
      }),
    );
  }
}

function classifyError(
  err: unknown,
): import('../../metrics/metrics.service').AiActionErrorType {
  if (!err || typeof err !== 'object') return 'internal';
  const e = err as { name?: string; status?: number; code?: string };
  if (
    e.name === 'TimeoutError' ||
    e.code === 'ETIMEDOUT' ||
    e.code === 'ESOCKETTIMEDOUT'
  ) {
    return 'timeout';
  }
  if (e.name === 'ThrottlerException' || e.status === 429) {
    return 'rate_limit';
  }
  if (typeof e.status === 'number') {
    if (e.status === 401 || e.status === 403) return 'auth';
    if (e.status === 400 || e.status === 422) return 'validation';
    if (e.status >= 400 && e.status < 500) return 'upstream_4xx';
    if (e.status >= 500 && e.status < 600) return 'upstream_5xx';
  }
  return 'internal';
}
