/**
 * UpdateTierTemplateDto — Phase 10 Tier Pool.
 */

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,

  Length,
  Min,
} from 'class-validator';
import { TierTemplateStatus } from '@prisma/client';

export class UpdateTierTemplateDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 200)
  tagline?: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsEnum(TierTemplateStatus)
  status?: TierTemplateStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsString()
  defaultBillingTierId?: string | null;
}
