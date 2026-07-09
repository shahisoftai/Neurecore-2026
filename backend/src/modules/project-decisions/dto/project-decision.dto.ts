/**
 * project-decisions module — DTOs
 *
 * Phase 5: Decision Registry
 * SOLID: Single Responsibility — validation only.
 */

import {
  IsString,
  IsOptional,
  IsIn,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
  IsDateString,
} from 'class-validator';

export const DECISION_STATUSES = ['PROPOSED', 'APPROVED', 'REJECTED', 'SUPERSEDED'] as const;
export const VOTE_OPTIONS = ['FOR', 'AGAINST', 'ABSTAIN'] as const;

export class CreateDecisionDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(DECISION_STATUSES as unknown as string[])
  status?: (typeof DECISION_STATUSES)[number];

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsString()
  meetingNotes?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string;

  @IsOptional()
  @IsDateString()
  expiryDate?: string;

  @IsOptional()
  @IsString()
  linkedEntityType?: string;

  @IsOptional()
  @IsString()
  linkedEntityId?: string;
}

export class UpdateDecisionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(DECISION_STATUSES as unknown as string[])
  status?: (typeof DECISION_STATUSES)[number];

  @IsOptional()
  @IsString()
  rationale?: string;

  @IsOptional()
  @IsString()
  meetingNotes?: string;

  @IsOptional()
  @IsDateString()
  effectiveDate?: string | null;

  @IsOptional()
  @IsDateString()
  expiryDate?: string | null;

  @IsOptional()
  @IsString()
  supersededBy?: string | null;
}

export class CastVoteDto {
  @IsString()
  @IsIn(VOTE_OPTIONS as unknown as string[])
  vote!: (typeof VOTE_OPTIONS)[number];
}

export class ApproveDecisionDto {
  @IsString()
  @IsNotEmpty()
  approvedById!: string;

  @IsOptional()
  @IsString()
  approvedByType?: string;
}

export class ListDecisionsDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsIn(DECISION_STATUSES as unknown as string[])
  status?: (typeof DECISION_STATUSES)[number];

  @IsOptional()
  @IsString()
  linkedEntityId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
