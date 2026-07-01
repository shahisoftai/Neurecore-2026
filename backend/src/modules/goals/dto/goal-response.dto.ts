/**
 * GoalResponseDto — wire-shape for Goal entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md §5.1).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { GoalLevel, GoalStatus } from '@prisma/client';

export class GoalResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Reach 10K MAU by Q4' })
  @Expose()
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: GoalLevel })
  @Expose()
  level!: GoalLevel;

  @ApiProperty({ enum: GoalStatus })
  @Expose()
  status!: GoalStatus;

  @ApiProperty({ minimum: 0, maximum: 100, example: 42 })
  @Expose()
  progress!: number;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  parentId?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  ownerUserId?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  ownerAgentId?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  departmentId?: string | null;

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
