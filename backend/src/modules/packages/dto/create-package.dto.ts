/**
 * CreatePackageDto — Phase 10 Package Pool (composite root).
 */

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,

  Length,
  Matches,
  Min,
} from 'class-validator';
import { PackageStatus } from '@prisma/client';

export class CreatePackageDto {
  @IsString()
  @Matches(/^[a-z0-9-]+$/, {
    message: 'slug must be lowercase alphanumeric with hyphens',
  })
  @Length(2, 80)
  slug!: string;

  @IsString()
  @Length(2, 200)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;

  @IsOptional()
  @IsEnum(PackageStatus)
  status?: PackageStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsString()
  industryId!: string;

  /**
   * TIER-SYSTEM-CONCEPT.md Phase 3 — single Tier table is canonical.
   * (Previously `tierTemplateId` referencing the TierTemplate pool table.)
   */
  @IsString()
  tierId!: string;
}
