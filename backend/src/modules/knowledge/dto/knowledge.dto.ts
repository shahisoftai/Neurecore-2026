/**
 * Knowledge — DTOs for request validation + OpenAPI annotation.
 *
 * Phase 6, Task 6.1 (per EAOS-api-contract.md §8.17 + §5.x response DTOs).
 */

import {
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsUrl,
  IsBoolean,
  IsInt,
  Min,
  Max,
  MaxLength,
  ArrayMaxSize,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';
import { KnowledgeType } from '@prisma/client';
import { PaginatedResponse } from '../../../common/responses/paginated.response';
import type { KnowledgeEntry } from '@prisma/client';

const KNOWLEDGE_TYPES = Object.values(KnowledgeType) as KnowledgeType[];

// ─── Create ───────────────────────────────────────────────────────────────

export class CreateKnowledgeDto {
  @ApiProperty({
    enum: KNOWLEDGE_TYPES,
    example: KnowledgeType.POLICY,
    description: 'Classification of the knowledge entry.',
  })
  @IsEnum(KnowledgeType)
  type!: KnowledgeType;

  @ApiProperty({
    example: 'Q3 Sales Methodology',
    maxLength: 200,
    description: 'Human-readable title.',
  })
  @IsString()
  @MaxLength(200)
  title!: string;

  @ApiProperty({
    example: 'Q3 sales methodology — pipeline stages, …',
    description: 'Full text content. Will be chunked + embedded.',
  })
  @IsString()
  @MaxLength(200_000)
  content!: string;

  @ApiPropertyOptional({
    example: ['sales', 'q3', 'methodology'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  tags?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    type: [String],
    example: ['PROJECT', 'GOAL'],
    description: 'Entity types this knowledge applies to.',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityTypes?: string[];

  @ApiPropertyOptional({ example: 'https://internal.drive/q3-methodology' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  sourceUrl?: string;

  @ApiPropertyOptional({
    enum: ['draft', 'published', 'archived'],
    example: 'published',
    default: 'published',
  })
  @IsOptional()
  @IsString()
  status?: 'draft' | 'published' | 'archived';

  @ApiPropertyOptional({
    default: 'en',
    example: 'en',
    description: 'ISO 639-1 language code.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(8)
  language?: string;
}

// ─── Update ───────────────────────────────────────────────────────────────

export class UpdateKnowledgeDto {
  @ApiPropertyOptional({ enum: KNOWLEDGE_TYPES })
  @IsOptional()
  @IsEnum(KnowledgeType)
  type?: KnowledgeType;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string;

  @ApiPropertyOptional({ maxLength: 200_000 })
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  content?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(50)
  tags?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  entityTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: 'draft' | 'published' | 'archived';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(16)
  language?: string;
}

// ─── List filter ──────────────────────────────────────────────────────────

export class ListKnowledgeDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ enum: KNOWLEDGE_TYPES })
  @IsOptional()
  @IsEnum(KnowledgeType)
  type?: KnowledgeType;

  @ApiPropertyOptional({ enum: ['draft', 'published', 'archived'] })
  @IsOptional()
  @IsString()
  status?: 'draft' | 'published' | 'archived';

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({
    description: 'Comma-separated tag list; AND-match (every tag must match).',
    example: 'sales,q3',
  })
  @IsOptional()
  @IsString()
  tags?: string;
}

// ─── Hybrid search ────────────────────────────────────────────────────────

export class SearchKnowledgeDto {
  @ApiProperty({ example: 'Q3 sales methodology', minLength: 1 })
  @IsString()
  query!: string;

  @ApiPropertyOptional({ enum: KNOWLEDGE_TYPES })
  @IsOptional()
  @IsEnum(KnowledgeType)
  type?: KnowledgeType;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 10;

  @ApiPropertyOptional({
    default: 0.7,
    minimum: 0,
    maximum: 1,
    description: 'Weight for vector similarity. (1 - α) is BM25 keyword weight.',
  })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  @Max(1)
  vectorWeight?: number = 0.7;
}

// ─── RAG ask ──────────────────────────────────────────────────────────────

export class RagAskDto {
  @ApiProperty({
    example: 'What is our Q3 sales methodology?',
    minLength: 1,
    maxLength: 4_000,
  })
  @IsString()
  @MaxLength(4_000)
  question!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  contextEntityType?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  contextEntityId?: string;

  @ApiPropertyOptional({ type: [String], enum: KNOWLEDGE_TYPES })
  @IsOptional()
  @IsArray()
  @IsEnum(KnowledgeType, { each: true })
  types?: KnowledgeType[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  departmentId?: string;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 25 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(25)
  topK?: number = 10;

  @ApiPropertyOptional({ default: 4_000, minimum: 256, maximum: 16_000 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(256)
  @Max(16_000)
  maxContextTokens?: number = 4_000;

  @ApiPropertyOptional({
    default: true,
    description: 'If true, return SSE stream; if false, block until done.',
  })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  stream?: boolean = true;
}

// ─── Response shapes ──────────────────────────────────────────────────────

export class KnowledgeEntryResponseDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() tenantId!: string;
  @ApiProperty({ enum: KNOWLEDGE_TYPES }) type!: KnowledgeType;
  @ApiProperty() title!: string;
  @ApiProperty() content!: string;
  @ApiPropertyOptional({ type: [String] }) tags!: string[];
  @ApiPropertyOptional({ format: 'uuid' }) departmentId?: string;
  @ApiPropertyOptional({ type: [String] }) entityTypes!: string[];
  @ApiProperty() source!: string;
  @ApiPropertyOptional() sourceUrl?: string;
  @ApiPropertyOptional({ format: 'uuid' }) authorId?: string;
  @ApiProperty({ enum: ['draft', 'published', 'archived'] }) status!: string;
  @ApiProperty() version!: string;
  @ApiProperty() language!: string;
  @ApiProperty() chunkCount!: number;
  @ApiProperty() retrievalCount!: number;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  lastRetrievedAt?: string;
  @ApiProperty({ type: String, format: 'date-time' })
  effectiveFrom!: string;
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  effectiveTo?: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;

  static fromEntity(e: KnowledgeEntry): KnowledgeEntryResponseDto {
    const dto = new KnowledgeEntryResponseDto();
    dto.id = e.id;
    dto.tenantId = e.tenantId;
    dto.type = e.type;
    dto.title = e.title;
    dto.content = e.content;
    dto.tags = e.tags ?? [];
    dto.departmentId = e.departmentId ?? undefined;
    dto.entityTypes = e.entityTypes ?? [];
    dto.source = e.source;
    dto.sourceUrl = e.sourceUrl ?? undefined;
    dto.authorId = e.authorId ?? undefined;
    dto.status = e.status;
    dto.version = e.version;
    dto.language = e.language;
    dto.chunkCount = e.chunkCount;
    dto.retrievalCount = e.retrievalCount;
    dto.lastRetrievedAt = e.lastRetrievedAt?.toISOString();
    dto.effectiveFrom = e.effectiveFrom.toISOString();
    dto.effectiveTo = e.effectiveTo?.toISOString();
    dto.createdAt = e.createdAt.toISOString();
    dto.updatedAt = e.updatedAt.toISOString();
    return dto;
  }
}

export class KnowledgeSearchHitDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: KNOWLEDGE_TYPES }) type!: KnowledgeType;
  @ApiProperty() excerpt!: string;
  @ApiProperty({
    description: 'Blended hybrid relevance score ∈ [0, 1].',
    example: 0.84,
  })
  relevanceScore!: number;
  @ApiPropertyOptional({ type: [String], description: 'Keyword highlights.' })
  highlights?: string[];
  @ApiPropertyOptional() departmentId?: string;
  @ApiPropertyOptional({ type: [String] }) tags?: string[];
}

export class KnowledgeSearchResponseDto {
  @ApiProperty({ type: [KnowledgeSearchHitDto] })
  results!: KnowledgeSearchHitDto[];
  @ApiProperty() took!: number; // ms
  @ApiProperty() query!: string;
}

export class KnowledgeCitationDto {
  @ApiProperty({ format: 'uuid' }) knowledgeEntryId!: string;
  @ApiProperty() label!: string;
  @ApiProperty({ example: 'Chunk 2 / 4' }) span!: string;
  @ApiProperty({ example: 0.84 }) confidence!: number;
  @ApiProperty({ example: 2 }) chunkIndex!: number;
}

export class RagAnswerResponseDto {
  @ApiProperty() answer!: string;
  @ApiProperty({ type: [KnowledgeCitationDto] })
  citations!: KnowledgeCitationDto[];
  @ApiProperty({ example: 'gpt-4o-mini' }) model!: string;
  @ApiProperty({ type: Object })
  tokensUsed!: { input: number; output: number; total: number };
  @ApiProperty({ example: 0.82 }) confidence!: number;
  @ApiProperty({ example: 2_184 }) durationMs!: number;
}

export class KnowledgeCitationUsageDto {
  @ApiProperty({ format: 'uuid' }) invocationId!: string;
  @ApiProperty({ format: 'uuid' }) knowledgeEntryId!: string;
  @ApiProperty() question!: string;
  @ApiProperty({ example: 0.84 }) score!: number;
  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class KnowledgePaginatedResponseDto extends PaginatedResponse<KnowledgeEntryResponseDto> {}