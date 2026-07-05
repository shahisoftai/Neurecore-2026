/**
 * UpdatePackageCompositionDto — replaces the three M2M relations atomically.
 *
 * The Package.composition is its primary identity. We provide a single
 * transactional endpoint instead of three separate set/delete calls so the
 * admin UI can operate on "the composition as one logical unit" (SRP).
 */

import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsOptional,
  IsUUID,
  Min,
} from 'class-validator';

export class UpdatePackageCompositionDto {
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(200)
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(200)
  aiAgentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @ArrayMaxSize(100)
  featureIds?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  suggestedAgentCount?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  suggestedDepartmentCount?: number;
}

export class PackagePreviewDto {
  @IsUUID('4')
  industryId!: string;

  @IsUUID('4')
  tierTemplateId!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  departmentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  @Type(() => String)
  aiAgentIds?: string[];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  featureIds?: string[];
}
