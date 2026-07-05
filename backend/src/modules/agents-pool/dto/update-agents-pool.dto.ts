/**
 * UpdateAgentsPoolDto — Phase 10 AI Employees Pool.
 */

import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { AgentType } from '@prisma/client';

export class UpdateAgentsPoolDto {
  @IsOptional()
  @IsString()
  @Length(2, 100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(AgentType)
  type?: AgentType;

  @IsOptional()
  @IsString()
  @Length(1, 60)
  model?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsString()
  instructions?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  @Matches(/^\d+\.\d+\.\d+$/, { message: 'version must be semver' })
  version?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}

export class ToggleEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}
