/**
 * Responses — DTOs (Phase 2B)
 */

import {
  Allow,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class RecordResponseDto {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsString()
  questionId!: string;

  // An information response value may be any JSON type — string (TEXT/SELECT/
  // DATE), number (NUMBER/CURRENCY), boolean (BOOLEAN), array (MULTI_SELECT),
  // object, or null (SYSTEM "unanswered" seed rows). The Prisma column is
  // `Json` and the service treats it as `unknown`, so we accept any value.
  // @Allow keeps `value` whitelisted (not stripped by `whitelist:true`) while
  // accepting primitives and null. @IsObject rejected every primitive answer
  // (the Discovery "Save answer" loop bug); @IsDefined would reject the null
  // seed rows the ProjectsAdapter writes for unanswered required questions.
  @Allow()
  value!: unknown;

  @IsString()
  sourceType!: string;

  @IsString()
  sourceLabel!: string;

  @IsOptional()
  @IsString()
  sourceRefType?: string;

  @IsOptional()
  @IsString()
  sourceRefId?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  confidence?: number;

  @IsOptional()
  @IsBoolean()
  verified?: boolean;

  @IsOptional()
  @IsBoolean()
  skipSupersede?: boolean;
}

export class ListResponsesDto {
  @IsString()
  entityType!: string;

  @IsString()
  entityId!: string;

  @IsOptional()
  @IsString()
  questionId?: string;
}
