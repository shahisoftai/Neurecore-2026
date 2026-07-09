/**
 * discovery/types.ts — Public shape of the Information Engine UI.
 *
 * Re-exports engine types from the existing projectTypes.service so the
 * UI layer never reaches into raw backend JSON shapes.
 */

export type {
  FieldSchemaItem,
  StageTemplateItem,
  ProjectType,
  ProjectTypeVersion,
} from '@/services/projectTypes.service';

/**
 * Polymorphic Information Engine types. These mirror the backend
 * `InformationEntityType` enum (project-creation-imp-plan.md §2.1).
 * Only PROJECT is exercised in Phase 2D; the others are reserved for
 * future entity types (Customer, Vendor, etc.).
 */
export type InformationEntityType =
  | 'PROJECT'
  | 'CUSTOMER'
  | 'VENDOR'
  | 'EMPLOYEE'
  | 'COMPLIANCE_RECORD'
  | 'ORGANIZATION';

export type InformationSourceType =
  | 'USER_INPUT'
  | 'DOCUMENT_EXTRACTION'
  | 'INTERVIEW'
  | 'ERP'
  | 'CRM'
  | 'API'
  | 'AI_INFERRED'
  | 'SYSTEM';

export type AskChannel = 'form' | 'interview' | 'document';

/**
 * Resolved question — flat shape produced by the engine's
 * RequirementsService.resolveForProjectType(). One row per question that
 * is currently in scope for the entity.
 */
export interface ResolvedQuestion {
  /** Globally unique: `${packKey}.${questionId}` (or just `questionId` for inline). */
  id: string;
  packKey: string;
  questionId: string;
  label: string;
  helpText?: string;
  type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT' | 'MULTI_SELECT' | 'BOOLEAN' | 'CURRENCY';
  required: boolean;
  options?: string[];
  mapsTo?: { field: string };
  skipIfConfidenceGte?: number;
  askVia?: AskChannel[];
}

/**
 * InformationResponse — engine's stored answer for a (entity, question)
 * pair. Mirrors backend `InformationResponse`.
 */
export interface InformationResponseDto {
  id: string;
  entityType: InformationEntityType;
  entityId: string;
  questionId: string;
  value: unknown;
  sourceId: string;
  confidence: number;
  supersededById: string | null;
  createdAt: string;
}

export type MissingWhy = 'NO_RESPONSE' | 'BELOW_THRESHOLD' | 'APPLIES_WHEN_FALSE';

export interface MissingItem {
  questionId: string;
  label: string;
  whyMissing: MissingWhy;
  confidence: number;
  suggestSourceTypes: InformationSourceType[];
}

export interface EntityCompleteness {
  entityType: InformationEntityType;
  entityId: string;
  score: number;
  totalRequired: number;
  totalResolved: number;
  missing: MissingItem[];
  lastAssessedAt: string;
}

/**
 * InformationRequirement — the raw shape used in question packs and
 * `ProjectTypeVersion.informationRequirements`. Mirrors backend.
 */
export interface InformationRequirement {
  id: string;
  label: string;
  helpText?: string;
  type: ResolvedQuestion['type'];
  required: boolean;
  options?: string[];
  appliesWhen?: {
    hasCustomer?: boolean;
    classification?: string[];
    hasEntityField?: {
      entityType: InformationEntityType;
      field: string;
      equals: unknown;
    };
  };
  mapsTo?: { field: string };
  skipIfConfidenceGte?: number;
  askVia?: AskChannel[];
}

export type QuestionPack = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  version: number;
  isSystem: boolean;
  questions: InformationRequirement[];
};