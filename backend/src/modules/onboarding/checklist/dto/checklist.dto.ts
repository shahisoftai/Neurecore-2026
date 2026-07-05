import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

/**
 * Generic payload for autosave / save. Wizard-specific validation lives in the
 * Zod schemas on the frontend; the backend treats this as opaque Json to keep
 * `OnboardingService.markComplete(slug, payload)` polymorphic across the 11
 * sub-wizards.
 *
 * Per-wizard DTOs will be added in PR-3 — until then, payloads are opaque.
 */
export class SaveChecklistEntryDto {
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;
}

export class DismissChecklistEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class SkipChecklistEntryDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DismissAllChecklistDto {
  @IsBoolean()
  dismissed!: boolean;
}
