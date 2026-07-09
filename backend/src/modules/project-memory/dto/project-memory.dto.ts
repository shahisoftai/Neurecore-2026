/**
 * project-memory module — DTOs
 *
 * Phase 5: Project Memory
 * SOLID: Single Responsibility — validation only.
 */

import {
  IsString,
  IsOptional,
  IsIn,
  IsBoolean,
  IsInt,
  Min,
  Max,
  IsNotEmpty,
} from 'class-validator';

export const MEMORY_CATEGORIES = ['NOTE', 'INSIGHT', 'CONSTRAINT', 'RISK', 'OPPORTUNITY', 'LESSON'] as const;
export const AUTHOR_TYPES = ['HUMAN', 'AI', 'SYSTEM'] as const;

export class CreateMemoryDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsIn(AUTHOR_TYPES as unknown as string[])
  authorType?: (typeof AUTHOR_TYPES)[number];

  @IsOptional()
  @IsIn(MEMORY_CATEGORIES as unknown as string[])
  category?: (typeof MEMORY_CATEGORIES)[number];

  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsOptional()
  @IsString()
  sourceEntityType?: string;

  @IsOptional()
  @IsString()
  sourceEntityId?: string;

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsBoolean()
  isAiGenerated?: boolean;
}

export class UpdateMemoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsIn(MEMORY_CATEGORIES as unknown as string[])
  category?: (typeof MEMORY_CATEGORIES)[number];

  @IsOptional()
  @IsBoolean()
  isPinned?: boolean;

  @IsOptional()
  @IsString()
  supersededBy?: string | null;
}

export class ListMemoriesDto {
  @IsOptional()
  @IsString()
  projectId?: string;

  @IsOptional()
  @IsString()
  authorId?: string;

  @IsOptional()
  @IsIn(MEMORY_CATEGORIES as unknown as string[])
  category?: (typeof MEMORY_CATEGORIES)[number];

  @IsOptional()
  @IsString()
  sourceEntityId?: string;

  @IsOptional()
  @IsString()
  search?: string;

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

export class SearchMemoriesDto {
  @IsString()
  @IsNotEmpty()
  projectId!: string;

  @IsString()
  @IsNotEmpty()
  query!: string;
}
