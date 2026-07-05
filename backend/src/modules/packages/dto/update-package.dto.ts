/**
 * UpdatePackageDto — partial update for non-composition fields.
 */

import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Min,
} from 'class-validator';
import { PackageStatus } from '@prisma/client';

export class UpdatePackageDto {
  @IsOptional()
  @IsString()
  @Length(2, 200)
  name?: string;

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
}
