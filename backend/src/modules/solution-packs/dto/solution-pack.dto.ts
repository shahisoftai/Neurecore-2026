/**
 * Solution Pack DTOs (per EAOS-api-contract.md §8.19).
 *
 * Phase 7, Tasks 7.1 + 7.4 + 7.5 + 7.9.
 */

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import type {
  PackTierRequired,
  SolutionExtensions,
  SolutionPackCategory,
  SolutionPackOwnerKind,
  SolutionPackStatus,
} from '../interfaces/solution-pack.interface';

export class ListSolutionPacksDto {
  @ApiPropertyOptional({ enum: ['VERTICAL', 'HORIZONTAL'] })
  @IsEnum(['VERTICAL', 'HORIZONTAL'])
  @IsOptional()
  category?: SolutionPackCategory;

  @ApiPropertyOptional({
    enum: ['draft', 'beta', 'stable', 'deprecated'],
    description:
      'Filter by lifecycle status. Defaults to published packs (stable + beta).',
  })
  @IsEnum(['draft', 'beta', 'stable', 'deprecated'])
  @IsOptional()
  status?: SolutionPackStatus;

  @ApiPropertyOptional({
    description:
      'Filter by required tier (returns packs the tenant tier can install).',
    enum: ['COMMUNITY', 'STARTER', 'PRO', 'ENTERPRISE'],
  })
  @IsEnum(['COMMUNITY', 'STARTER', 'PRO', 'ENTERPRISE'])
  @IsOptional()
  tierRequired?: PackTierRequired;

  @ApiPropertyOptional({
    description: 'Free-text search across name + description + tags.',
  })
  @IsString()
  @IsOptional()
  @Length(1, 200)
  q?: string;

  @ApiPropertyOptional({
    description: 'Only return packs installed by the current tenant.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  installedOnly?: boolean;
}

export class InstallSolutionPackDto {
  @ApiPropertyOptional({
    description:
      'If true, install even when pre-flight checks produced non-blocking warnings ' +
      '(e.g. suggested integrations are not yet connected). Defaults to false.',
    default: false,
  })
  @IsBoolean()
  @IsOptional()
  @Type(() => Boolean)
  acceptWarnings?: boolean;

  @ApiPropertyOptional({
    description:
      'Optional client-supplied idempotency key. If a previous install request with the same ' +
      'key already succeeded for this tenant+pack, the existing install is returned.',
  })
  @IsString()
  @IsOptional()
  @Length(8, 80)
  idempotencyKey?: string;
}

export class CreateSolutionPackDto {
  @ApiProperty()
  @IsString()
  @Length(2, 80)
  slug!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiProperty()
  @IsString()
  @Length(2, 4000)
  description!: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 240)
  shortDescription?: string;

  @ApiProperty({ enum: ['VERTICAL', 'HORIZONTAL'] })
  @IsEnum(['VERTICAL', 'HORIZONTAL'])
  category!: SolutionPackCategory;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional({ description: 'Hex color (e.g. "#6366f1").' })
  @IsString()
  @IsOptional()
  @Length(4, 9)
  color?: string;

  @ApiPropertyOptional({
    enum: ['COMMUNITY', 'STARTER', 'PRO', 'ENTERPRISE'],
    default: 'PRO',
  })
  @IsEnum(['COMMUNITY', 'STARTER', 'PRO', 'ENTERPRISE'])
  @IsOptional()
  tierRequired?: PackTierRequired;

  @ApiPropertyOptional({
    enum: ['draft', 'beta', 'stable', 'deprecated'],
    default: 'draft',
  })
  @IsEnum(['draft', 'beta', 'stable', 'deprecated'])
  @IsOptional()
  status?: SolutionPackStatus;

  @ApiPropertyOptional({
    enum: ['SEED', 'PLATFORM', 'TENANT'],
    default: 'PLATFORM',
  })
  @IsEnum(['SEED', 'PLATFORM', 'TENANT'])
  @IsOptional()
  ownerKind?: SolutionPackOwnerKind;

  @ApiPropertyOptional({
    description: 'Owner tenant id (when ownerKind = TENANT).',
  })
  @IsString()
  @IsOptional()
  ownerId?: string;

  @ApiPropertyOptional({
    description: 'Full extensions object (see SolutionExtensions interface).',
    type: Object,
  })
  @IsObject()
  @IsOptional()
  extensions?: SolutionExtensions;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  requiresPacks?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  conflictsWith?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  monthlyPriceUsd?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedAiCredits?: number;

  @ApiPropertyOptional({ default: 100 })
  @IsInt()
  @Min(0)
  @Max(10_000)
  @IsOptional()
  sortOrder?: number;
}

export class UpdateSolutionPackDto {
  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(2, 4000)
  description?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(0, 240)
  shortDescription?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  icon?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  @Length(4, 9)
  color?: string;

  @ApiPropertyOptional({ enum: ['COMMUNITY', 'STARTER', 'PRO', 'ENTERPRISE'] })
  @IsEnum(['COMMUNITY', 'STARTER', 'PRO', 'ENTERPRISE'])
  @IsOptional()
  tierRequired?: PackTierRequired;

  @ApiPropertyOptional({ enum: ['draft', 'beta', 'stable', 'deprecated'] })
  @IsEnum(['draft', 'beta', 'stable', 'deprecated'])
  @IsOptional()
  status?: SolutionPackStatus;

  @ApiPropertyOptional({ type: Object })
  @IsObject()
  @IsOptional()
  extensions?: SolutionExtensions;

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  requiresPacks?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  conflictsWith?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  monthlyPriceUsd?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @IsOptional()
  estimatedAiCredits?: number;

  @ApiPropertyOptional()
  @IsInt()
  @Min(0)
  @Max(10_000)
  @IsOptional()
  sortOrder?: number;
}

export class PublishSolutionPackDto {
  @ApiPropertyOptional({
    description: 'Optional release notes for this version.',
  })
  @IsString()
  @IsOptional()
  @Length(0, 2000)
  changelog?: string;
}

/**
 * Used internally — never exposed via the controller.
 */
export interface ResolvedTierContext {
  tenantId: string;
  tenantTier: PackTierRequired;
  tenantTierSlug: string;
}
