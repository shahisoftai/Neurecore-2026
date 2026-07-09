/**
 * AdaptiveQuestioning — Service (Phase 2B)
 *
 * Deterministic (§15 question #2): next question = first in order that
 * (a) hasn't been answered at the required confidence, and
 * (b) passes `appliesWhen` against the current context.
 *
 * A response "answers" a question if EITHER no `skipIfConfidenceGte` is
 * set, OR the response's confidence is ≥ the threshold.
 */

import { Injectable } from '@nestjs/common';
import type {
  IAdaptiveQuestioningService,
  ResolvedQuestion,
  ResolveContext,
} from './interfaces/requirements.interface';
import { filterByAppliesWhen } from '../common/appliesWhen';

@Injectable()
export class AdaptiveQuestioningService implements IAdaptiveQuestioningService {
  async pickNext(
    resolved: ResolvedQuestion[],
    ctx: ResolveContext,
  ): Promise<ResolvedQuestion | null> {
    // Re-evaluate appliesWhen in case ctx has changed since resolve.
    const inScope = filterByAppliesWhen(
      resolved as never[],
      ctx,
    ) as ResolvedQuestion[];

    const responsesByQuestion = new Map<
      string,
      { value: unknown; confidence: number }
    >();
    if (ctx.currentResponses) {
      for (const r of ctx.currentResponses) {
        if (!responsesByQuestion.has(r.questionId)) {
          responsesByQuestion.set(r.questionId, {
            value: r.value,
            confidence: r.confidence,
          });
        }
      }
    }

    for (const q of inScope) {
      // Match either by qualified id (e.g. "core.taxYear") or by local id.
      const response =
        responsesByQuestion.get(q.id) ?? responsesByQuestion.get(q.questionId);
      const isAnswered =
        response !== undefined &&
        response.value !== null &&
        response.value !== undefined &&
        response.value !== '' &&
        (q.skipIfConfidenceGte === undefined ||
          response.confidence >= q.skipIfConfidenceGte);
      if (isAnswered) continue;
      return q;
    }

    return null;
  }
}
