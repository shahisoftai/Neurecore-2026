/**
 * UpdateFeatureDto — Phase 10 Feature Pool.
 */

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { FeatureCategory } from '@prisma/client';

export class UpdateFeatureDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @IsOptional()
  @IsEnum(FeatureCategory)
  category?: FeatureCategory;

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
