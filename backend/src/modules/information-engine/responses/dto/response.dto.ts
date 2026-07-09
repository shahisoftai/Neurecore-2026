/**
 * Responses — DTOs (Phase 2B)
 */

import {
  IsBoolean,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RecordResponseDto {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsString()
  questionId!: string;

  @IsObject()
  value!: unknown;

  @IsString()
  sourceType!: string;

  @IsString()
  sourceLabel!: string;

  @IsOptional()
  @IsString()
  sourceRefType?: string;

  @IsOptional()
  @IsString()
  sourceRefId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidence?: number;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsBoolean()
  skipSupersede?: boolean;
}

export class ListResponsesDto {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  questionId?: string;
}
