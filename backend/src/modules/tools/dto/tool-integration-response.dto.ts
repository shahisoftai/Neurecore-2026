/**
 * ToolIntegrationResponseDto — wire-shape for ToolIntegration entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md §5.1).
 *
 * Excludes the `config` JSON (which may contain auth secrets) and
 * `executionLogs` (per-relation).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ToolCategory } from '@prisma/client';

export class ToolIntegrationResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Google Drive integration' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: ToolCategory })
  @Expose()
  category!: ToolCategory;

  @ApiProperty({ example: true })
  @Expose()
  isActive!: boolean;

  @ApiProperty({ example: false })
  @Expose()
  isBuiltIn!: boolean;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  tenantId?: string | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
