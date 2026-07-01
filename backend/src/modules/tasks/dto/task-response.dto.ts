/**
 * TaskResponseDto — wire-shape for Task entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md §5.1).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { TaskPriority, TaskStatus } from '@prisma/client';

export class TaskResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Write Q3 blog post' })
  @Expose()
  title!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: TaskStatus })
  @Expose()
  status!: TaskStatus;

  @ApiProperty({ enum: TaskPriority })
  @Expose()
  priority!: TaskPriority;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  error?: string | null;

  @ApiProperty({ example: 0 })
  @Expose()
  retryCount!: number;

  @ApiProperty({ example: 3 })
  @Expose()
  maxRetries!: number;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  agentId?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  workflowId?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  createdById?: string | null;

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
