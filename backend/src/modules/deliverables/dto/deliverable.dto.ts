/**
 * Deliverables Module — DTOs
 *
 * Validation decorators following Solid principles:
 * - Each DTO has a single responsibility
 * - No logic, only data shape and validation
 */

import {
  IsString,
  IsOptional,
  IsIn,
  IsNumber,
  IsObject,
  IsNotEmpty,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export const DELIVERABLE_STATUSES = ['DRAFT', 'IN_REVIEW', 'APPROVED', 'REJECTED'] as const;
export const RISK_TIERS = ['LOW', 'MEDIUM', 'HIGH'] as const;

export class CreateDeliverableDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  goalId?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(DELIVERABLE_STATUSES as unknown as string[])
  status?: (typeof DELIVERABLE_STATUSES)[number];

  @IsOptional()
  @IsIn(RISK_TIERS as unknown as string[])
  riskTier?: (typeof RISK_TIERS)[number];
}

export class UpdateDeliverableDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(DELIVERABLE_STATUSES as unknown as string[])
  status?: (typeof DELIVERABLE_STATUSES)[number];

  @IsOptional()
  @IsIn(RISK_TIERS as unknown as string[])
  riskTier?: (typeof RISK_TIERS)[number];
}

export class CreateDeliverableVersionDto {
  @IsObject()
  content!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsString()
  producedBy?: string;

  @IsOptional()
  @IsString()
  producedByTaskId?: string;
}

export class ListDeliverablesDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  goalId?: string;

  @IsOptional()
  @IsIn(DELIVERABLE_STATUSES as unknown as string[])
  status?: (typeof DELIVERABLE_STATUSES)[number];

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number;
}
