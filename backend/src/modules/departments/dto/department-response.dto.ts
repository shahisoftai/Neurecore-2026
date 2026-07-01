/**
 * DepartmentResponseDto — wire-shape for Department entities.
 *
 * Phase 1, Task 1.10 (per `EAOS-api-contract.md` §5.1).
 * Excludes internal fields; uses @Expose() + class-transformer's
 * excludeExtraneousValues for safe serialization.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { DepartmentStatus } from '@prisma/client';

export class DepartmentResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Marketing' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: DepartmentStatus })
  @Expose()
  status!: DepartmentStatus;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  parentId?: string | null;

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
