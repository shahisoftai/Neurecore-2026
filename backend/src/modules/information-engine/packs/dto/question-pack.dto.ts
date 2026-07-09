/**
 * QuestionPack — DTOs (Phase 2B)
 */

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { QUESTION_REQUIREMENT_TYPES } from '../interfaces/question-pack.interface';
import type { InformationRequirementType } from '../../common/types';

export class AppliesWhenRuleDto {
  @IsOptional()
  @IsBoolean()
  hasCustomer?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  classification?: string[];
}

export class QuestionItemDto {
  @IsString()
  id!: string;

  @IsString()
  label!: string;

  @IsOptional()
  @IsString()
  helpText?: string;

  @IsIn(QUESTION_REQUIREMENT_TYPES as unknown as string[])
  type!: InformationRequirementType;

  @IsBoolean()
  required!: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => AppliesWhenRuleDto)
  appliesWhen?: AppliesWhenRuleDto;

  @IsOptional()
  @IsObject()
  mapsTo?: { field: string };

  @IsOptional()
  @IsNumber()
  @Min(0)
  skipIfConfidenceGte?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  askVia?: ('form' | 'interview' | 'document')[];
}

export class CreateQuestionPackDto {
  @IsString()
  key!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  questions!: QuestionItemDto[];

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class UpdateQuestionPackDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => QuestionItemDto)
  questions?: QuestionItemDto[];
}

export class ListQuestionPacksDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;

  @IsOptional()
  page?: number;

  @IsOptional()
  limit?: number;
}
