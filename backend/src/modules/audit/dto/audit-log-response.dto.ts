/**
 * AuditLogResponseDto — wire-shape for AuditLog entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md).
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';

export class AuditLogUserDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiProperty()
  @Expose()
  firstName!: string;

  @ApiProperty()
  @Expose()
  lastName!: string;
}

export class AuditLogResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty()
  @Expose()
  actor!: string;

  @ApiProperty()
  @Expose()
  action!: string;

  @ApiPropertyOptional()
  @Expose()
  resource?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  resourceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Expose()
  tenantId?: string;

  @ApiPropertyOptional()
  @Expose()
  ipAddress?: string;

  @ApiPropertyOptional()
  @Expose()
  userAgent?: string;

  @ApiProperty({ enum: ['success', 'failure'] })
  @Expose()
  result!: 'success' | 'failure';

  @ApiPropertyOptional()
  @Expose()
  details?: Record<string, unknown>;

  @ApiProperty()
  @Expose()
  createdAt!: Date;

  @ApiProperty({ type: AuditLogUserDto })
  @Expose()
  user!: AuditLogUserDto;
}
