/**
 * ProjectStages — DTOs
 */

import {
  IsString,
  IsOptional,
  IsInt,
  IsIn,
  IsDateString,
  IsArray,
  IsNotEmpty,
} from 'class-validator';

export const STAGE_STATUSES = [
  'NOT_STARTED',
  'IN_PROGRESS',
  'AT_RISK',
  'COMPLETED',
  'SKIPPED',
] as const;

export class CreateStageDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional() @IsString()
  description?: string;

  @IsInt()
  order!: number;

  @IsOptional() @IsIn(STAGE_STATUSES as unknown as string[])
  status?: (typeof STAGE_STATUSES)[number];

  @IsOptional() @IsDateString()
  startDate?: string;

  @IsOptional() @IsDateString()
  endDate?: string;
}

export class UpdateStageDto {
  @IsOptional() @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsIn(STAGE_STATUSES as unknown as string[])
  status?: (typeof STAGE_STATUSES)[number];

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class ReorderStagesDto {
  @IsArray()
  @IsString({ each: true })
  orderedIds!: string[];
}
