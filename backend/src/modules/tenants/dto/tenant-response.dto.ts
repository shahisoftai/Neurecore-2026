/**
 * TenantResponseDto — wire-shape for Tenant entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md §5.1).
 *
 * Excludes billing, payment, and subscription internals. Use the
 * dedicated /billing and /subscription endpoints for those.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { TenantStatus } from '@prisma/client';

export class TenantResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ example: 'Acme Corp' })
  @Expose()
  name!: string;

  @ApiProperty({ example: 'acme' })
  @Expose()
  slug!: string;

  @ApiProperty({ enum: TenantStatus })
  @Expose()
  status!: TenantStatus;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  logoUrl?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  website?: string | null;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  industry?: string | null;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty()
  @Expose()
  updatedAt!: Date;
}
