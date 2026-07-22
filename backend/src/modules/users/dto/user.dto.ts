import {
  IsEmail,
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  IsObject,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { UserRole } from '@prisma/client';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  firstName!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lastName!: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsString()
  tenantId?: string;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  lastName?: string;

  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  departmentId?: string | null;

  // ─── Personal profile fields ──────────────────────────────────────
  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(15)
  locale?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  language?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  theme?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  defaultLanding?: string | null;

  @IsOptional()
  @IsBoolean()
  railCollapsedDefault?: boolean;

  /**
   * Stored under User.notificationPrefsJson. Typed at runtime by convention.
   */
  @IsOptional()
  @IsObject()
  notificationPrefs?: Record<string, unknown>;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}

export class AssignUserToDepartmentDto {
  @IsString()
  departmentId!: string;
}

/**
 * 2FA enable — frontend submits TOTP code to confirm QR scan succeeded.
 * Backend stores hashed secret + boolean flag under User.metadata.twoFactor*.
 */
export class Enable2faDto {
  @IsString()
  @MinLength(6)
  @MaxLength(8)
  code!: string;
}

/**
 * 2FA disable — requires re-authentication via password.
 */
export class Disable2faDto {
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password!: string;
}
