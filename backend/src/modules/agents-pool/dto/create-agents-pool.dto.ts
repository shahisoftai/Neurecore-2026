/**
 * CreateAgentsPoolDto — Phase 10 AI Employees Pool.
 *
 * Mirrors CreateAgentTemplateDto without `tenantId` (pool UI manages
 * platform-wide templates only — tenantId=null).
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

export class CreateAgentsPoolDto {
  @IsString()
  @Length(2, 100)
  name!: string;

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
