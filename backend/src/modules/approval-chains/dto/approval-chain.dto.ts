/**
 * approval-chains module — DTOs
 *
 * Phase 4: Approval chain resolution.
 * SOLID: Single Responsibility — validation only.
 */

import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  Min,
  Max,
  IsBoolean,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export const APPROVAL_ACTIONS = ['APPROVE', 'REJECT', 'ESCALATE', 'REQUEST_INFO'] as const;

export class ApprovalActionDto {
  @IsString()
  @IsIn(APPROVAL_ACTIONS as unknown as string[])
  action!: (typeof APPROVAL_ACTIONS)[number];

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ResolveApprovalChainDto {
  @IsString()
  deliverableId!: string;

  @IsString()
  projectTypeVersionId!: string;
}

export class ListApprovalWorkflowsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  riskTier?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class ApprovalStepDecisionDto {
  @IsString()
  @IsIn(APPROVAL_ACTIONS as unknown as string[])
  action!: (typeof APPROVAL_ACTIONS)[number];

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
