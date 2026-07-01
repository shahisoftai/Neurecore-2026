/**
 * RoutineResponseDto — wire-shape for Routine entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md §5.1).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { RoutineStatus } from '@prisma/client';

export class RoutineResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Daily report generator' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: RoutineStatus })
  @Expose()
  status!: RoutineStatus;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  ownerAgentId?: string | null;

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
