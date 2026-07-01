import { IsEmail, IsEnum, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@prisma/client';

export class UpdateOnboardingStateDto {
  @IsOptional()
  @IsString()
  step?: string;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  logoUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  timezone?: string;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  industry?: string;

  @IsOptional()
  @IsString()
  tierId?: string;

  @IsOptional()
  @IsString()
  templateSlug?: string;
}

export class SelectTierDto {
  @IsString()
  tierId!: string;
}

export class SelectTemplateDto {
  @IsString()
  templateSlug!: string;

  @IsOptional()
  agentOverrides?: Record<string, { name?: string; isSelected?: boolean }>;
}

export class InviteMemberDto {
  @IsEmail()
  email!: string;

  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;
}

export class InviteMembersDto {
  invites!: InviteMemberDto[];
}

export class AcceptInviteDto {
  @IsString()
  firstName!: string;

  @IsString()
  lastName!: string;

  @IsString()
  @MinLength(8)
  password!: string;
}