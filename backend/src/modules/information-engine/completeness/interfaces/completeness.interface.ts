/**
 * Completeness — Interfaces (Phase 2B)
 *
 * SOLID: contracts only — no implementation.
 */

import type {
  InformationEntityType,
  InformationSourceType,
} from '../../common/types';

export const COMPLETENESS_REPOSITORY = 'COMPLETENESS_REPOSITORY';

export type WhyMissing =
  | 'NO_RESPONSE'
  | 'BELOW_THRESHOLD'
  | 'APPLIES_WHEN_FALSE';

export type MissingItem = {
  questionId: string;
  label: string;
  whyMissing: WhyMissing;
  confidence: number;
  suggestSourceTypes: InformationSourceType[];
};

export type EntityCompletenessSnapshot = {
  entityType: InformationEntityType;
  entityId: string;
  score: number;
  totalRequired: number;
  totalResolved: number;
  missing: MissingItem[];
  lastAssessedAt: Date;
};

export type EntityCompletenessRow = EntityCompletenessSnapshot & {
  id: string;
};

export type UpsertCompletenessInput = EntityCompletenessSnapshot;

export interface ICompletenessRepository {
  upsert(input: UpsertCompletenessInput): Promise<EntityCompletenessRow>;
  findByEntity(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<EntityCompletenessRow | null>;
}

export interface ICompletenessService {
  recompute(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<EntityCompletenessSnapshot>;
  get(
    entityType: InformationEntityType,
    entityId: string,
  ): Promise<EntityCompletenessSnapshot | null>;
}
