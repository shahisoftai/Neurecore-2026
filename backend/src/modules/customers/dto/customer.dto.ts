/**
 * Customers Module — DTOs
 */

import {
  IsString,
  IsOptional,
  IsEmail,
  IsArray,
  IsIn,
  IsObject,
  IsBoolean,
  IsNotEmpty,
  MaxLength,
} from 'class-validator';

export class CreateCustomerDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsEmail()
  primaryEmail?: string;

  @IsOptional()
  @IsString()
  primaryPhone?: string;

  @IsOptional()
  @IsObject()
  billingInfo?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Phase 4 — Financial & Compliance fields (per INDUSTRY-REQUIREMENTS-STAGED.md
  // §3.4). Persisted on first-class columns by PrismaCustomerRepository.create().
  // Empty strings are normalised to undefined by the FE so the BE validator
  // never sees "" (which would fail IsEnum).
  @IsOptional()
  @IsIn(['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'])
  kycStatus?: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REJECTED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskRating?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsIn([
    'BANKING',
    'INSURANCE',
    'WEALTH_MANAGEMENT',
    'INVESTMENT',
    'FINTECH',
    'ACCOUNTING_AUDIT',
  ])
  financialSubType?:
    | 'BANKING'
    | 'INSURANCE'
    | 'WEALTH_MANAGEMENT'
    | 'INVESTMENT'
    | 'FINTECH'
    | 'ACCOUNTING_AUDIT';

  @IsOptional()
  @IsIn(['PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED'])
  lifecycleStage?:
    | 'PROSPECT'
    | 'KYC_VERIFIED'
    | 'ACTIVE'
    | 'DORMANT'
    | 'CLOSED';
}

export class UpdateCustomerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsEmail()
  primaryEmail?: string;

  @IsOptional()
  @IsString()
  primaryPhone?: string;

  @IsOptional()
  @IsObject()
  billingInfo?: Record<string, unknown>;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  // Phase 4 — Financial & Compliance fields (mirror CreateCustomerDto so
  // the global ValidationPipe whitelist doesn't strip them).
  @IsOptional()
  @IsIn(['PENDING', 'VERIFIED', 'EXPIRED', 'REJECTED'])
  kycStatus?: 'PENDING' | 'VERIFIED' | 'EXPIRED' | 'REJECTED';

  @IsOptional()
  @IsIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'])
  riskRating?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  @IsOptional()
  @IsString()
  @MaxLength(64)
  taxId?: string;

  @IsOptional()
  @IsIn([
    'BANKING',
    'INSURANCE',
    'WEALTH_MANAGEMENT',
    'INVESTMENT',
    'FINTECH',
    'ACCOUNTING_AUDIT',
  ])
  financialSubType?:
    | 'BANKING'
    | 'INSURANCE'
    | 'WEALTH_MANAGEMENT'
    | 'INVESTMENT'
    | 'FINTECH'
    | 'ACCOUNTING_AUDIT';

  @IsOptional()
  @IsIn(['PROSPECT', 'KYC_VERIFIED', 'ACTIVE', 'DORMANT', 'CLOSED'])
  lifecycleStage?:
    | 'PROSPECT'
    | 'KYC_VERIFIED'
    | 'ACTIVE'
    | 'DORMANT'
    | 'CLOSED';
}

export class AddCustomerContactDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEmail()
  email!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  role?: string;

  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class ListCustomersQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['ACTIVE', 'INACTIVE', 'ARCHIVED'])
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;

  @IsOptional()
  @IsIn(['name', 'industry', 'status', 'createdAt', 'updatedAt'])
  sortKey?: 'name' | 'industry' | 'status' | 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortDir?: 'asc' | 'desc';

  @IsOptional()
  @IsIn([
    'BANKING',
    'INSURANCE',
    'WEALTH_MANAGEMENT',
    'INVESTMENT',
    'FINTECH',
    'ACCOUNTING_AUDIT',
  ])
  financialSubType?:
    | 'BANKING'
    | 'INSURANCE'
    | 'WEALTH_MANAGEMENT'
    | 'INVESTMENT'
    | 'FINTECH'
    | 'ACCOUNTING_AUDIT';
}
