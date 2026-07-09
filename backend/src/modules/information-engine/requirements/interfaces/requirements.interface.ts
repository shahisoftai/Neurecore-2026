/**
 * Requirements — Interfaces (Phase 2B)
 *
 * Pure resolver + adaptive selector. No DB writes here.
 */

import type {
  InformationEntityType,
  InformationRequirementType,
  AskChannel,
  ProjectTypeClassification,
} from '../../common/types';
import type { AppliesWhenRule } from '../../../project-types/interfaces/project-type.interface';

export type ResolvedQuestion = {
  /** Globally unique question id: `${packKey}.${questionId}` */
  id: string;
  packKey: string;
  questionId: string;
  label: string;
  helpText?: string;
  type: InformationRequirementType;
  required: boolean;
  options?: string[];
  mapsTo?: { field: string };
  skipIfConfidenceGte?: number;
  askVia?: AskChannel[];
  /** Carried through from the source question for downstream re-evaluation. */
  appliesWhen?: AppliesWhenRule;
};

export type ResolveContext = {
  entityType: InformationEntityType;
  entityId: string;
  hasCustomer?: boolean;
  classification?: ProjectTypeClassification | null;
  currentResponses?: Array<{
    questionId: string;
    value: unknown;
    confidence: number;
  }>;
};

export type SourceQuestion = {
  id: string;
  label: string;
  helpText?: string;
  type: InformationRequirementType;
  required: boolean;
  options?: string[];
  appliesWhen?: AppliesWhenRule;
  mapsTo?: { field: string };
  skipIfConfidenceGte?: number;
  askVia?: AskChannel[];
};

export type SourcePack = {
  key: string;
  questions: SourceQuestion[];
};

export interface IRequirementsService {
  resolveForProjectType(
    projectTypeInformationRequirements: SourceQuestion[],
    linkedPacks: SourcePack[],
    ctx: ResolveContext,
  ): Promise<ResolvedQuestion[]>;

  /**
   * Pure validator used by adapters before destructive actions
   * (stage transition, deliverable publish, contract sign).
   */
  validateAnswersAgainstRequirements(
    resolved: ResolvedQuestion[],
    responses: Array<{ questionId: string; value: unknown }>,
  ):
    | { ok: true }
    | { ok: false; missing: { questionId: string; label: string }[] };
}

export interface IAdaptiveQuestioningService {
  /**
   * Deterministic: returns the next unresolved question, or null when
   * the entity is complete. Filters out answered, high-confidence, and
   * `appliesWhen`-false questions.
   */
  pickNext(
    resolved: ResolvedQuestion[],
    ctx: ResolveContext,
  ): Promise<ResolvedQuestion | null>;
}
