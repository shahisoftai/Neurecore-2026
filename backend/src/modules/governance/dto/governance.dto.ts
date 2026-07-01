import {
  IsString,
  IsOptional,
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
} from 'class-validator';
import { GovernanceActionType } from '@prisma/client';

export class CreateGovernanceRuleDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsString() trigger!: string;
  @IsEnum(GovernanceActionType) @IsOptional() actionType?: GovernanceActionType;
  @IsObject() @IsOptional() actionConfig?: Record<string, unknown>;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsInt() @IsOptional() priority?: number;
}

export class UpdateGovernanceRuleDto {
  @IsString() @IsOptional() name?: string;
  @IsString() @IsOptional() description?: string;
  @IsString() @IsOptional() trigger?: string;
  @IsEnum(GovernanceActionType) @IsOptional() actionType?: GovernanceActionType;
  @IsObject() @IsOptional() actionConfig?: Record<string, unknown>;
  @IsBoolean() @IsOptional() isActive?: boolean;
  @IsInt() @IsOptional() priority?: number;
}
