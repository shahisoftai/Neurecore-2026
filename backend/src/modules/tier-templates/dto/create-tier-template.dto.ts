/**
 * CreateTierTemplateDto — Phase 10 Tier Pool (commercial offering).
 */

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  Min,
} from 'class-validator';
import { TierTemplateStatus } from '@prisma/client';

export class CreateTierTemplateDto {
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
  @IsUUID('4')
  defaultBillingTierId?: string;
}
