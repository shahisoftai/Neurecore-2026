/**
 * approvals module — DTOs
 *
 * SOLID: SRP — validation only.
 */

import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsIn,
  IsBoolean,
} from 'class-validator';

export class StratifiedApprovalsDto {
  @IsOptional()
  @IsString()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'IN_PROGRESS'])
  status?: string;
}

export class SubmitFeedbackDto {
  @IsString()
  @IsNotEmpty()
  approvalId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['approve', 'reject', 'review'])
  userDecision!: 'approve' | 'reject' | 'review';

  @IsString()
  @IsNotEmpty()
  aiRecommendation!: string;

  @IsString()
  @IsNotEmpty()
  reasoning!: string;

  @IsBoolean()
  @IsNotEmpty()
  isDiscrepancy!: boolean;
}

export class ApproveRequestDto {
  @IsString()
  @IsNotEmpty()
  approvalId!: string;
}

export class RejectRequestDto {
  @IsString()
  @IsNotEmpty()
  approvalId!: string;
}
