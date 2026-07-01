import {
  IsEnum,
  IsString,
  IsNumber,
  IsOptional,
  Min,
  IsObject,
  IsUUID,
  MaxLength,
} from 'class-validator';

export enum ExpenseCategoryDto {
  AGENT_EXECUTION = 'AGENT_EXECUTION',
  TOOL_USAGE = 'TOOL_USAGE',
  API_CALL = 'API_CALL',
  MODEL_INFERENCE = 'MODEL_INFERENCE',
  CONNECTOR_SYNC = 'CONNECTOR_SYNC',
  CUSTOM = 'CUSTOM',
}

export class RecordExpenseDto {
  @IsOptional()
  @IsUUID()
  tenantId?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsUUID()
  invoiceId?: string;

  @IsEnum(ExpenseCategoryDto)
  category!: ExpenseCategoryDto;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsNumber()
  @Min(0)
  amountUsd!: number;

  @IsOptional()
  @IsString()
  @MaxLength(3)
  currency?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
