import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { UniversalStateValue } from '@prisma/client';

export const EAOS_ENTITY_TYPES = [
  'DEPARTMENT',
  'AGENT',
  'USER',
  'PROJECT',
  'GOAL',
  'TASK',
  'WORKFLOW',
  'ROUTINE',
  'TOOL_INTEGRATION',
  'EXPENSE',
  'INVOICE',
  'KNOWLEDGE_ENTRY',
  'TEMPLATE',
] as const;

export type EaosEntityType = (typeof EAOS_ENTITY_TYPES)[number];

/**
 * Resource-type → Prisma model name mapping (used by the entity dispatcher
 * to load the underlying row). Phase 3, Task 3.1 + 3.4.
 */
export const EAOS_ENTITY_MODEL_MAP: Readonly<Record<EaosEntityType, string>> = {
  DEPARTMENT: 'department',
  AGENT: 'agent',
  USER: 'user',
  PROJECT: 'project',
  GOAL: 'goal',
  TASK: 'task',
  WORKFLOW: 'workflow',
  ROUTINE: 'routine',
  TOOL_INTEGRATION: 'toolIntegration',
  EXPENSE: 'expense',
  INVOICE: 'invoice',
  KNOWLEDGE_ENTRY: 'memoryEntry', // nearest existing model; will be replaced in Phase 6
  TEMPLATE: 'agentTemplate', // nearest existing model
};

export class EntityTypeParamDto {
  @ApiProperty({ enum: EAOS_ENTITY_TYPES, description: 'Entity type (case-insensitive)' })
  @IsString()
  type!: string;
}

export class EntityIdParamDto extends EntityTypeParamDto {
  @ApiProperty({ description: 'Entity UUID' })
  @IsUUID()
  id!: string;
}

export class LifecycleTransitionDto {
  @ApiProperty({ enum: UniversalStateValue, description: 'Current state (validation only)' })
  @IsEnum(UniversalStateValue)
  @IsOptional()
  from?: UniversalStateValue;

  @ApiProperty({ enum: UniversalStateValue, description: 'Target state' })
  @IsEnum(UniversalStateValue)
  to!: UniversalStateValue;

  @ApiPropertyOptional({ description: 'Human-readable reason for transition' })
  @IsString()
  @IsOptional()
  reason?: string;

  @ApiPropertyOptional({ description: 'Optional state metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class EntityLabelDto {
  @ApiProperty({ description: 'Label key (e.g. "priority", "region")' })
  @IsString()
  @IsNotEmpty()
  key!: string;

  @ApiProperty({ description: 'Label value' })
  @IsString()
  @IsNotEmpty()
  value!: string;

  @ApiPropertyOptional({ description: 'Optional hex color override' })
  @IsString()
  @IsOptional()
  color?: string;
}
