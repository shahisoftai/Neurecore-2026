/**
 * Information Engine — Narrowed Type Aliases
 *
 * Single source of truth for the engine's polymorphic primitives.
 * Mirrors the Prisma enums but exposed as plain string-literal unions so
 * downstream code (DTOs, services, tests) can use them without importing
 * Prisma's enum types.
 *
 * NOTE: `AppliesWhenRule` and `InformationRequirement` live in
 * `project-types/interfaces/project-type.interface.ts` (their original
 * home). Re-exported here for engine consumers' convenience.
 */

export type {
  InformationRequirement,
  InformationRequirementType,
  AppliesWhenRule,
} from '../../project-types/interfaces/project-type.interface';

export const INFORMATION_ENTITY_TYPES = [
  'PROJECT',
  'CUSTOMER',
  'VENDOR',
  'EMPLOYEE',
  'COMPLIANCE_RECORD',
  'ORGANIZATION',
] as const;

export type InformationEntityType = (typeof INFORMATION_ENTITY_TYPES)[number];

export const INFORMATION_SOURCE_TYPES = [
  'USER_INPUT',
  'DOCUMENT_EXTRACTION',
  'INTERVIEW',
  'ERP',
  'CRM',
  'API',
  'AI_INFERRED',
  'SYSTEM',
] as const;

export type InformationSourceType = (typeof INFORMATION_SOURCE_TYPES)[number];

export const PROJECT_TYPE_CLASSIFICATIONS = [
  'CLIENT_ENGAGEMENT',
  'INTERNAL_INITIATIVE',
  'OPERATIONAL_PROGRAM',
] as const;

export type ProjectTypeClassification =
  (typeof PROJECT_TYPE_CLASSIFICATIONS)[number];

export const INFORMATION_REQUIREMENT_TYPES = [
  'TEXT',
  'NUMBER',
  'DATE',
  'SELECT',
  'MULTI_SELECT',
  'BOOLEAN',
  'CURRENCY',
] as const;

export const ASK_CHANNELS = ['form', 'interview', 'document'] as const;
export type AskChannel = (typeof ASK_CHANNELS)[number];

/** Narrow type guard — used by controllers to validate query params. */
export function isInformationEntityType(
  value: unknown,
): value is InformationEntityType {
  return (
    typeof value === 'string' &&
    (INFORMATION_ENTITY_TYPES as readonly string[]).includes(value)
  );
}

export function isInformationSourceType(
  value: unknown,
): value is InformationSourceType {
  return (
    typeof value === 'string' &&
    (INFORMATION_SOURCE_TYPES as readonly string[]).includes(value)
  );
}

export function isProjectTypeClassification(
  value: unknown,
): value is ProjectTypeClassification {
  return (
    typeof value === 'string' &&
    (PROJECT_TYPE_CLASSIFICATIONS as readonly string[]).includes(value)
  );
}
