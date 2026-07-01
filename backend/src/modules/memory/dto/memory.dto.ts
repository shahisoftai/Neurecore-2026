import {
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsObject,
  IsDateString,
  Min,
  Max,
} from 'class-validator';
import { MemoryType } from '@prisma/client';

export class CreateMemoryDto {
  @IsEnum(MemoryType)
  type!: MemoryType;

  @IsString()
  content!: string;

  @IsOptional()
  @IsString()
  summary?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  importance?: number;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class SearchMemoryDto {
  @IsString()
  query!: string;

  @IsOptional()
  @IsEnum(MemoryType)
  type?: MemoryType;

  @IsOptional()
  @IsString()
  agentId?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;
}
