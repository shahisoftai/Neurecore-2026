/**
 * Sources — DTOs (Phase 2B)
 */

import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { INFORMATION_SOURCE_TYPES } from '../../common/types';
import type { InformationSourceType } from '../../common/types';

export class CreateSourceDto {
  @IsString()
  type!: InformationSourceType;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  refType?: string;

  @IsOptional()
  @IsString()
  refId?: string;

  @IsInt()
  @Min(0)
  @Max(100)
  confidence!: number;
}

export const SOURCE_TYPE_VALUES = INFORMATION_SOURCE_TYPES;
