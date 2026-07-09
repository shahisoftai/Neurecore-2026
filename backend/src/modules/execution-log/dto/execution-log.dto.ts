/**
 * execution-log module — DTOs
 *
 * Phase 4: Append-only. Read + Create only.
 * SOLID: Single Responsibility — validation only.
 */

import {
  IsString,
  IsOptional,
  IsObject,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
} from 'class-validator';

export class CreateLogEntryDto {
  @IsString()
  @IsNotEmpty()
  taskId!: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsString()
  @IsNotEmpty()
  action!: string;

  @IsOptional()
  @IsString()
  actorType?: string;

  @IsOptional()
  @IsString()
  actorId?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ListLogEntriesDto {
  @IsOptional()
  @IsString()
  taskId?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;
}
