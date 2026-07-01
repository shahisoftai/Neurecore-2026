/**
 * Cost Module - DTOs
 *
 * Data Transfer Objects for validation and type safety
 * Following NestJS DTO patterns with class-validator
 */

import {
  IsString,
  IsNumber,
  IsEnum,
  IsOptional,
  IsArray,
  IsDateString,
  IsInt,
  Min,
  Max,
  IsUUID,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

// ─── Enums ──────────────────────────────────────────────────────────────────

export enum BudgetPeriod {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
}

export enum BudgetScope {
  TENANT = 'TENANT',
  DEPARTMENT = 'DEPARTMENT',
  AGENT = 'AGENT',
  MODEL = 'MODEL',
}

export enum BudgetAction {
  ALERT = 'ALERT',
  BLOCK = 'BLOCK',
  DEGRADE = 'DEGRADE',
}

export enum IncidentStatus {
  ACTIVE = 'ACTIVE',
  ACKNOWLEDGED = 'ACKNOWLEDGED',
  RESOLVED = 'RESOLVED',
}

// ─── Cost Query DTOs ────────────────────────────────────────────────────────

/**
 * Query parameters for fetching cost data
 */
export class CostQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsUUID()
  agentId?: string;

  @IsOptional()
  @IsString()
  provider?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;
}

/**
 * Cost summary response DTO
 */
export class CostSummaryDto {
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  recordCount: number;
  byModel?: Record<string, number>;
  byProvider?: Record<string, number>;
  currency: string = 'USD';
}

/**
 * Timeline point DTO
 */
export class CostTimelinePointDto {
  timestamp: Date;
  costCents: number;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Cost timeline response DTO
 */
export class CostTimelineDto {
  points: CostTimelinePointDto[];
  granularity: 'hour' | 'day' | 'week' | 'month';
}

// ─── Budget Policy DTOs ─────────────────────────────────────────────────────

/**
 * Create budget policy DTO
 */
export class CreateBudgetPolicyDto {
  @IsString()
  name: string;

  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limitCents: number;

  @IsEnum(BudgetPeriod)
  period: BudgetPeriod;

  @IsEnum(BudgetScope)
  scope: BudgetScope;

  @IsOptional()
  @IsString()
  scopeId?: string;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  @Transform(({ value }) => value ?? [50, 75, 90])
  alertThresholds?: number[];

  @IsOptional()
  @IsEnum(BudgetAction)
  action?: BudgetAction = BudgetAction.ALERT;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

/**
 * Update budget policy DTO
 */
export class UpdateBudgetPolicyDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  limitCents?: number;

  @IsOptional()
  @IsArray()
  @IsNumber({}, { each: true })
  alertThresholds?: number[];

  @IsOptional()
  @IsEnum(BudgetAction)
  action?: BudgetAction;

  @IsOptional()
  @IsUUID()
  departmentId?: string;
}

/**
 * Budget policy response DTO
 */
export class BudgetPolicyDto {
  id: string;
  tenantId: string;
  name: string;
  limitCents: number;
  period: BudgetPeriod;
  scope: BudgetScope;
  scopeId?: string;
  alertThresholds: number[];
  action: BudgetAction;
  enabled: boolean;
  currentSpendCents: number;
  resetAt: Date;
  utilizationPercent: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Budget incident response DTO
 */
export class BudgetIncidentDto {
  id: string;
  budgetPolicyId: string;
  policyName: string;
  threshold: number;
  totalCents: number;
  status: IncidentStatus;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

// ─── Cost Breakdown DTOs ─────────────────────────────────────────────────────

/**
 * Cost by agent response DTO
 */
export class CostByAgentDto {
  agentId: string;
  agentName: string;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  runCount: number;
}

/**
 * Cost by model response DTO
 */
export class CostByModelDto {
  model: string;
  provider: string;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  callCount: number;
}

/**
 * Cost by provider response DTO
 */
export class CostByProviderDto {
  provider: string;
  totalCostCents: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  modelCount: number;
}

// ─── Cost Record DTOs ───────────────────────────────────────────────────────

/**
 * Cost record response DTO
 */
export class CostRecordDto {
  id: string;
  tenantId: string;
  agentId?: string;
  departmentId?: string;
  runId?: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  costCents: number;
  windowStart: Date;
  windowEnd: Date;
  createdAt: Date;
}

/**
 * Cost record list response DTO
 */
export class CostRecordListDto {
  data: CostRecordDto[];
  total: number;
  limit: number;
  offset: number;
}
