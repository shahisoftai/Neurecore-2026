/**
 * AgentResponseDto — wire-shape for Agent entities.
 *
 * Phase 1, Task 1.8 (per `EAOS-api-contract.md` §5.1).
 *
 * Excludes internal fields (e.g. `permissions` JSON which may contain
 * sensitive ACL hints). All fields are `@Expose()`-marked so
 * `plainToInstance(AgentResponseDto, agent, { excludeExtraneousValues: true })`
 * strips anything not declared.
 *
 * For v1, this is a thin shape that returns the safe subset of Agent
 * fields. The full migration to a complete response DTO with
 * aggregation counts, related entity includes, etc. is Phase 4 of the
 * api-contract migration (EAOS-api-contract.md §12).
 */

import { ApiProperty } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { AgentStatus, AgentType } from '@prisma/client';

export class AgentResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Marketing Director' })
  @Expose()
  name!: string;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  description?: string | null;

  @ApiProperty({ enum: AgentType })
  @Expose()
  type!: AgentType;

  @ApiProperty({ enum: AgentStatus })
  @Expose()
  status!: AgentStatus;

  @ApiProperty({ example: 'gpt-4o-mini', required: false, nullable: true })
  @Expose()
  model?: string | null;

  @ApiProperty({ example: 100.0, required: false, nullable: true })
  @Expose()
  budgetPerDay?: number | null;

  @ApiProperty({ example: 42.5, required: false, nullable: true })
  @Expose()
  totalSpend?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  systemPrompt?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  instructions?: string | null;

  @ApiProperty()
  @Expose()
  isActive!: boolean;

  @ApiProperty({ format: 'uuid' })
  @Expose()
  tenantId!: string;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  departmentId?: string | null;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  templateId?: string | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
