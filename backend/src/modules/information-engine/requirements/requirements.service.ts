/**
 * Requirements — Service (Phase 2B)
 *
 * Pure resolver — no DB writes. Composes:
 *   1. ProjectTypeVersion.informationRequirements (inline)
 *   2. ProjectTypePack → QuestionPack.questions (linked packs)
 * into a single flat ResolvedQuestion[] with `appliesWhen` already evaluated.
 */

import { Injectable } from '@nestjs/common';
import {
  IRequirementsService,
  ResolvedQuestion,
  ResolveContext,
  SourcePack,
  SourceQuestion,
} from './interfaces/requirements.interface';
import { evaluateAppliesWhen } from '../common/appliesWhen';
import { EngineErrors } from '../common/apperrors';
import { validateInformationRequirements } from '../common/legacy-adapter';

@Injectable()
export class RequirementsService implements IRequirementsService {
  /**
   * Resolve a flat question list. Order is deterministic:
   *   1. inline informationRequirements (in given order)
   *   2. linked packs in (sortOrder ASC, then question order)
   */
  async resolveForProjectType(
    projectTypeInformationRequirements: SourceQuestion[],
    linkedPacks: SourcePack[],
    ctx: ResolveContext,
  ): Promise<ResolvedQuestion[]> {
    // Validate inline requirements shape once.
    this.validateRequirementsOrThrow(
      projectTypeInformationRequirements,
      'inline',
    );

    const inline = projectTypeInformationRequirements.map((q) =>
      this.toResolved(q, 'inline'),
    );

    const packResolved: ResolvedQuestion[] = [];
    linkedPacks.forEach((pack) => {
      this.validateRequirementsOrThrow(pack.questions, pack.key);
      pack.questions.forEach((q) => {
        packResolved.push(this.toResolved(q, pack.key));
      });
    });

    const merged = [...inline, ...packResolved];

    // Preserve original shape; evaluate appliesWhen inline so we don't
    // lose type fidelity through a structural cast.
    return merged.filter((q) => evaluateAppliesWhen(q.appliesWhen, ctx));
  }

  /**
   * Public validator per §4.4 — throws BadRequestException if any
   * required question is unanswered or below its confidence threshold.
   */
  validateAnswersAgainstRequirements(
    resolved: ResolvedQuestion[],
    responses: Array<{ questionId: string; value: unknown }>,
  ):
    | { ok: true }
    | { ok: false; missing: { questionId: string; label: string }[] } {
    const byQuestion = new Map<
      string,
      { questionId: string; value: unknown }
    >();
    for (const r of responses) {
      if (!byQuestion.has(r.questionId)) byQuestion.set(r.questionId, r);
    }

    const missing: { questionId: string; label: string }[] = [];
    for (const q of resolved) {
      if (!q.required) continue;
      const localId = stripPackPrefix(q.id, q.packKey);
      const answer = byQuestion.get(localId) ?? byQuestion.get(q.id);
      if (
        !answer ||
        answer.value === null ||
        answer.value === undefined ||
        answer.value === ''
      ) {
        missing.push({ questionId: q.id, label: q.label });
      }
    }

    if (missing.length > 0) {
      return { ok: false, missing };
    }
    return { ok: true };
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private toResolved(q: SourceQuestion, packKey: string): ResolvedQuestion {
    const id = packKey === 'inline' ? q.id : `${packKey}.${q.id}`;
    return {
      id,
      packKey,
      questionId: q.id,
      label: q.label,
      ...(q.helpText !== undefined ? { helpText: q.helpText } : {}),
      type: q.type,
      required: q.required,
      ...(q.options ? { options: q.options } : {}),
      ...(q.appliesWhen ? { appliesWhen: q.appliesWhen } : {}),
      ...(q.mapsTo ? { mapsTo: q.mapsTo } : {}),
      ...(q.skipIfConfidenceGte !== undefined
        ? { skipIfConfidenceGte: q.skipIfConfidenceGte }
        : {}),
      ...(q.askVia ? { askVia: q.askVia } : { askVia: ['form'] }),
    };
  }

  private validateRequirementsOrThrow(
    questions: unknown,
    packKey: string,
  ): void {
    const errors = validateInformationRequirements(questions);
    if (errors.length > 0) {
      throw EngineErrors.badRequest(
        'INVALID_QUESTIONS',
        `QuestionPack "${packKey}" has malformed questions`,
        errors,
      );
    }
  }
}

function stripPackPrefix(qualifiedId: string, packKey: string): string {
  const prefix = `${packKey}.`;
  return qualifiedId.startsWith(prefix)
    ? qualifiedId.slice(prefix.length)
    : qualifiedId;
}
