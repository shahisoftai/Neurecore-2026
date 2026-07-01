/**
 * UserResponseDto — wire-shape for User entities.
 * Phase 1, Task 1.10 (per EAOS-api-contract.md §5.1).
 *
 * Excludes passwordHash, refresh tokens, sessions — sensitive data that
 * must never be on the wire.
 */

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose } from 'class-transformer';
import { UserRole } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty({ format: 'uuid' })
  @Expose()
  id!: string;

  @ApiProperty({ format: 'email' })
  @Expose()
  email!: string;

  @ApiProperty({ example: 'Sarah' })
  @Expose()
  firstName!: string;

  @ApiProperty({ example: 'Chen' })
  @Expose()
  lastName!: string;

  @ApiProperty({ enum: UserRole })
  @Expose()
  role!: UserRole;

  @ApiProperty({ required: false, nullable: true })
  @Expose()
  avatarUrl?: string | null;

  @ApiProperty({ example: true })
  @Expose()
  isActive!: boolean;

  @ApiProperty({ example: false })
  @Expose()
  isVerified!: boolean;

  @ApiProperty({ format: 'uuid', required: false, nullable: true })
  @Expose()
  departmentId?: string | null;

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
