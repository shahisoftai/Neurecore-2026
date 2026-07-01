/**
 * ProjectResponseDto — wire-shape for Project entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md §5.1).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { ProjectStatus } from '@prisma/client';

export class ProjectResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Q3 2026 Growth' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: ProjectStatus })
  @Expose()
  status!: ProjectStatus;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  departmentId?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  targetDate?: Date | null;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  tenantId!: string;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
