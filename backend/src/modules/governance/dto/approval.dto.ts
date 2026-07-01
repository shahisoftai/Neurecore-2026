import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsDateString,
} from 'class-validator';
import { ApprovalStatus, ApprovalPriority } from '@prisma/client';

export class CreateApprovalDto {
  @IsString() title!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() resourceType!: string;
  @IsOptional() @IsString() resourceId?: string;
  @IsObject() @IsOptional() payload?: Record<string, unknown>;
  @IsEnum(ApprovalPriority) @IsOptional() priority?: ApprovalPriority;
  @IsOptional() @IsString() requiredRole?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class ReviewApprovalDto {
  @IsEnum(ApprovalStatus) status!: 'APPROVED' | 'REJECTED';
  @IsOptional() @IsString() rejectionReason?: string;
}
