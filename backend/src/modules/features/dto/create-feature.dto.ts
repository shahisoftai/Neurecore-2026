/**
 * CreateFeatureDto — Phase 10 Feature Pool.
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
import { FeatureCategory } from '@prisma/client';

export class CreateFeatureDto {
  @IsString()
  @Matches(/^[a-z0-9_]+$/, {
    message: 'key must be lowercase alphanumeric with underscores',
  })
  @Length(2, 60)
  key!: string;

  @IsString()
  @Length(2, 100)
  name!: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsEnum(FeatureCategory)
  category!: FeatureCategory;

  @IsOptional()
  @IsString()
  @Length(0, 40)
  icon?: string;

  @IsOptional()
  @IsString()
  @Length(0, 60)
  integrationKey?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
