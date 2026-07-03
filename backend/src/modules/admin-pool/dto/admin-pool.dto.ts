/**
 * Admin Pool DTOs (per `memory-bank-new/admin-pool.md` §4.2).
 *
 * SOLID: SRP — owns ONLY HTTP input validation. Business rules live in services.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Industry } from '@prisma/client';
import type { IndustryPackageEntryPayload } from '../interfaces/admin-pool.interface';

const INDUSTRY_VALUES: Industry[] = [
  'HEALTHCARE',
  'LEGAL',
  'REAL_ESTATE',
  'ECOMMERCE',
  'SAAS',
  'EDUCATION',
  'FINANCE',
  'MARKETING_AGENCY',
  'CONSULTING',
  'MANUFACTURING',
  'GENERAL',
];

// ─── Pool departments ────────────────────────────────────────────────────────

export class UpdatePoolDepartmentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  icon?: string;

  @ApiPropertyOptional({ description: 'Hex color e.g. #3B82F6' })
  @IsOptional()
  @IsString()
  @Length(4, 16)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 280)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(999)
  sortOrder?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Pool agents ─────────────────────────────────────────────────────────────

export class ListPoolAgentsQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by division label, e.g. "Engineering"',
  })
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional({
    description: 'Filter by division slug, e.g. "engineering"',
  })
  @IsOptional()
  @IsString()
  divisionSlug?: string;

  @ApiPropertyOptional({
    description: 'Free-text search across name + description',
  })
  @IsOptional()
  @IsString()
  @Length(1, 120)
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class CreatePoolAgentDto {
  @ApiProperty({ maxLength: 120 })
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiProperty({ description: 'Division label (e.g. "Engineering")' })
  @IsString()
  @Length(1, 80)
  division!: string;

  @ApiProperty({
    description: 'Division slug (must match a PoolDepartment.slug)',
  })
  @IsString()
  @Length(1, 80)
  divisionSlug!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 8)
  emoji?: string;

  @ApiPropertyOptional({ description: 'Hex color e.g. #3B82F6' })
  @IsOptional()
  @IsString()
  @Length(4, 16)
  color?: string;

  @ApiProperty({ description: 'Full system prompt (markdown body)' })
  @IsString()
  @Length(1, 200_000)
  systemPrompt!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 20)
  version?: string;
}

export class UpdatePoolAgentDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  division?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  divisionSlug?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 60)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 8)
  emoji?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(4, 16)
  color?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 200_000)
  systemPrompt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

// ─── Industry packages ───────────────────────────────────────────────────────

export class CreateIndustryPackageDto {
  @ApiProperty({ enum: INDUSTRY_VALUES })
  @IsEnum(Industry)
  industry!: Industry;

  @ApiProperty({ description: 'Tier.id (UUID in fresh systems, "tier_pro"/"tier_enterprise" in this seed)' })
  @IsString()
  @Length(1, 60)
  tierId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 120)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;
}

export class UpdateIndustryPackageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 120)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 500)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRecommended?: boolean;
}

export class ReplaceIndustryPackageEntriesDto {
  @ApiProperty({ type: 'array' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IndustryPackageEntryItemDto)
  entries!: IndustryPackageEntryPayload[];
}

export class IndustryPackageEntryItemDto implements IndustryPackageEntryPayload {
  @ApiProperty()
  @IsUUID()
  poolAgentId!: string;

  @ApiProperty()
  @IsString()
  @Length(1, 80)
  divisionSlug!: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  slot?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isDefaultSelected?: boolean;

  @ApiPropertyOptional({ default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1000)
  defaultBudgetPerDay?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(0, 80)
  defaultModel?: string;
}

// ─── Recommendations / previews (used by FT onboarding wizard too) ─────────

export class PreviewIndustryPackageQueryDto {
  @ApiPropertyOptional({ enum: INDUSTRY_VALUES })
  @IsOptional()
  @IsEnum(Industry)
  industry?: Industry;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 60)
  tierId?: string;
}
