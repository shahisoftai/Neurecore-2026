/**
 * Completeness — Service (Phase 2B)
 *
 * Single Responsibility: recompute and read entity completeness.
 * Does NOT know how to resolve requirements or fetch responses — the caller
 * supplies the inputs. This breaks the cyclic dependency between
 * Completeness ↔ Responses ↔ Requirements.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { COMPLETENESS_REPOSITORY } from './interfaces/completeness.interface';
import type {
  ICompletenessService,
  ICompletenessRepository,
  EntityCompletenessSnapshot,
  MissingItem,
} from './interfaces/completeness.interface';
import type { InformationEntityType } from '../common/types';

export type CompletenessQuestion = {
  id: string;
  label: string;
  required: boolean;
  skipIfConfidenceGte?: number;
};

export type CompletenessResponse = {
  questionId: string;
  value: unknown;
  confidence: number;
};

/**
 * Inputs for `recompute()`. The caller (ResponsesService / adapters) is
 * responsible for resolving questions and gathering current responses.
 */
export type RecomputeInputs = {
  questions: CompletenessQuestion[];
  responses: CompletenessResponse[];
};

@Injectable()
export class CompletenessService implements ICompletenessService {
  private readonly logger = new Logger(CompletenessService.name);

  constructor(
    @Inject(COMPLETENESS_REPOSITORY)
    private readonly repo: ICompletenessRepository,
  ) {}

  async recompute(
    entityType: InformationEntityType,
    entityId: string,
    inputs?: RecomputeInputs,
  ): Promise<EntityCompletenessSnapshot> {
    const snapshot = inputs
      ? this.computeSnapshot(entityType, entityId, inputs)
      : this.emptySnapshot(entityType, entityId);

    await this.repo.upsert(snapshot);
    this.logger.debug(
      `Recompute ${entityType}/${entityId}: ${snapshot.score}% (${snapshot.totalResolved}/${snapshot.totalRequired})`,
    );
    return snapshot;
  }

  async get(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<EntityCompletenessSnapshot | null> {
    const row = await this.repo.findByEntity(entityType, entityId);
    if (!row) return null;
    // Strip `id` for the public DTO shape.
    const { id: _id, ...snapshot } = row;
    return snapshot;
  }

  // ─── Pure computation ─────────────────────────────────────────────────────

  /**
   * Pure — exported for unit testing without touching the repo.
   */
  computeSnapshot(
    entityType: InformationEntityType,
    entityId: string,
    inputs: RecomputeInputs,
  ): EntityCompletenessSnapshot {
    const required = inputs.questions.filter((q) => q.required);
    const totalRequired = required.length;
    if (totalRequired === 0) {
      return this.emptySnapshot(entityType, entityId);
    }

    const byQuestion = new Map<string, CompletenessResponse>();
    for (const r of inputs.responses) {
      if (!byQuestion.has(r.questionId)) byQuestion.set(r.questionId, r);
    }

    let resolved = 0;
    const missing: MissingItem[] = [];

    for (const q of required) {
      const r = byQuestion.get(q.id);
      const meetsThreshold =
        r !== undefined &&
        r.value !== null &&
        r.value !== undefined &&
        r.value !== '' &&
        (q.skipIfConfidenceGte === undefined ||
          r.confidence >= q.skipIfConfidenceGte);
      if (meetsThreshold && r) {
        resolved += 1;
        continue;
      }
      const why: MissingItem['whyMissing'] = r
        ? 'BELOW_THRESHOLD'
        : 'NO_RESPONSE';
      missing.push({
        questionId: q.id,
        label: q.label,
        whyMissing: why,
        confidence: r?.confidence ?? 0,
        suggestSourceTypes: r
          ? []
          : ['USER_INPUT', 'INTERVIEW', 'DOCUMENT_EXTRACTION'],
      });
    }

    const score = Math.round((resolved / totalRequired) * 100);
    return {
      entityType,
      entityId,
      score,
      totalRequired,
      totalResolved: resolved,
      missing,
      lastAssessedAt: new Date(),
    };
  }

  private emptySnapshot(
    entityType: InformationEntityType,
    entityId: string,
  ): EntityCompletenessSnapshot {
    return {
      entityType,
      entityId,
      score: 100,
      totalRequired: 0,
      totalResolved: 0,
      missing: [],
      lastAssessedAt: new Date(),
    };
  }
}
