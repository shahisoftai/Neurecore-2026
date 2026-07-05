/**
 * CreateIndustryDto — Phase 10 Industry Pool.
 * Mirrors the Zod schema in the frontend (per contract-test convention).
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

export class CreateIndustryDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  @Length(2, 60)
  slug!: string;

  @IsString()
  @Length(2, 100)
  name!: string;

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
