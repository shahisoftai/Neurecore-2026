import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MinLength,
  MaxLength,
  Matches,
  MaxLength as MaxLengthDecorator,
} from 'class-validator';
import { TenantStatus } from '@prisma/client';

export class CreateTenantDto {
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(32)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'Slug must be lowercase alphanumeric with hyphens',
  })
  slug!: string;

  @IsOptional()
  @IsUUID()
  tierId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  industry?: string;
}

export class UpdateTenantDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(64)
  name?: string;

  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(256)
  website?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  industry?: string;
}

export class ChangeTierDto {
  @IsString()
  tierId!: string;
}
