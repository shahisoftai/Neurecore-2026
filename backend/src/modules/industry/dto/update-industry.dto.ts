/**
 * UpdateIndustryDto — Phase 10 Industry Pool.
 * All fields optional for PATCH semantics.
 */

import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { IndustryStatus } from '@prisma/client';

export class UpdateIndustryDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  icon?: string;

  @IsOptional()
  @IsEnum(IndustryStatus)
  status?: IndustryStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
