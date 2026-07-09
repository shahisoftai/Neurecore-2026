/**
 * project-health module — DTOs
 *
 * Phase 6: Health Score + BI Dashboards
 * SOLID: Single Responsibility — validation only.
 */

import { IsString, IsOptional, IsNumber, Min, Max, IsIn } from 'class-validator';

export class GetProjectHealthDto {
  @IsString()
  projectId!: string;
}

export class ListAtRiskProjectsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  threshold?: number;
}

export class ComputeHealthDto {
  @IsString()
  projectId!: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  budgetBurnWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  timelineWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  activityRateWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  approvalDelayWeight?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  reworkRateWeight?: number;
}

export class GetAnalyticsDto {
  @IsOptional()
  @IsIn(['30d', '90d', '1y', 'all'])
  period?: '30d' | '90d' | '1y' | 'all';
}
