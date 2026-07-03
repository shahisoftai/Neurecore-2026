import { IsString, IsOptional, IsEnum, IsArray, IsObject, IsBoolean } from 'class-validator';
import { HermesAgentType } from '@prisma/client';

export class RegisterAgentDto {
  @IsString()
  name!: string;

  @IsEnum(HermesAgentType)
  type!: HermesAgentType;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsString()
  workspaceId?: string;
}

export class UpdateAgentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissions?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  workspaceId?: string;
}

export class AddCapabilityDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsObject()
  inputSchema?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  outputSchema?: Record<string, unknown>;

  @IsOptional()
  costEstimate?: number;

  @IsOptional()
  avgDuration?: number;
}

export class UpdateToolPermissionDto {
  @IsString()
  toolName!: string;

  @IsString()
  permission!: string;

  @IsOptional()
  @IsObject()
  conditions?: Record<string, unknown>;
}
