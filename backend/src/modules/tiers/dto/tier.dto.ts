/**
 * Tier DTOs - SOLID: Interface Segregation
 *
 * Small, focused DTOs for each operation
 */

import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsEnum,
  Min,
} from 'class-validator';

export class CreateTierDto {
  @IsString()
  name!: string;

  @IsString()
  slug!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  // Pricing
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  // Limits
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAgents?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxStorageGB?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxApiCalls?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxConversationMessages?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxFileSizeMB?: number;

  // Features
  @IsOptional()
  @IsBoolean()
  allowCustomBranding?: boolean;

  @IsOptional()
  @IsBoolean()
  allowApiAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSso?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAuditExport?: boolean;
}

export class UpdateTierDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @IsOptional()
  @IsNumber()
  sortOrder?: number;

  // Pricing
  @IsOptional()
  @IsNumber()
  @Min(0)
  monthlyPrice?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  yearlyPrice?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  // Limits
  @IsOptional()
  @IsNumber()
  @Min(1)
  maxUsers?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxAgents?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxStorageGB?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  maxApiCalls?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxConversationMessages?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  maxFileSizeMB?: number;

  // Features
  @IsOptional()
  @IsBoolean()
  allowCustomBranding?: boolean;

  @IsOptional()
  @IsBoolean()
  allowApiAccess?: boolean;

  @IsOptional()
  @IsBoolean()
  allowSso?: boolean;

  @IsOptional()
  @IsBoolean()
  allowAuditExport?: boolean;
}

export class ToggleTierDto {
  @IsBoolean()
  isActive!: boolean;
}

export class ReorderTiersDto {
  @IsString({ each: true })
  orderedIds!: string[];
}
