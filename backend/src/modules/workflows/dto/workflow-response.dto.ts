/**
 * WorkflowResponseDto — wire-shape for Workflow entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md §5.1).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { WorkflowStatus } from '@prisma/client';

export class WorkflowResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Lead nurturing sequence' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: WorkflowStatus })
  @Expose()
  status!: WorkflowStatus;

  @ApiProperty({ example: false })
  @Expose()
  isTemplate!: boolean;

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
