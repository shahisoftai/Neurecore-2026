/**
 * Goals Module DTOs
 *
 * Input validation using class-validator
 * Following SOLID: Single Responsibility - DTOs only handle validation
 */

import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsUUID,
} from 'class-validator';

import { GoalLevel, GoalStatus } from '@prisma/client';

export class CreateGoalDto {
  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GoalLevel)
  level?: GoalLevel;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsOptional()
  @IsUUID()
  ownerAgentId?: string;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  // Phase 3
  @IsOptional()
  @IsUUID()
  projectId?: string;
}

export class UpdateGoalDto {
  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(GoalLevel)
  level?: GoalLevel;

  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @IsOptional()
  @IsUUID()
  parentId?: string | null;

  @IsOptional()
  @IsUUID()
  ownerAgentId?: string | null;

  @IsOptional()
  @IsUUID()
  ownerUserId?: string | null;

  @IsOptional()
  @IsUUID()
  departmentId?: string | null;

  @IsOptional()
  @IsDateString()
  targetDate?: string | null;

  @IsOptional()
  @IsDateString()
  completedAt?: string | null;
}

export class ListGoalsDto {
  @IsOptional()
  @IsEnum(GoalStatus)
  status?: GoalStatus;

  @IsOptional()
  @IsEnum(GoalLevel)
  level?: GoalLevel;

  @IsOptional()
  @IsUUID()
  parentId?: string | 'root';

  @IsOptional()
  @IsUUID()
  ownerUserId?: string;

  @IsOptional()
  @IsUUID()
  ownerAgentId?: string;

  // Phase 3
  @IsOptional()
  @IsUUID()
  projectId?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}

export class GoalResponseDto {
  id!: string;
  title!: string;
  description?: string;
  level!: GoalLevel;
  status!: GoalStatus;
  progress!: number;
  parentId?: string;
  ownerAgentId?: string;
  ownerUserId?: string;
  departmentId?: string;
  targetDate?: Date;
  completedAt?: Date;
  createdAt!: Date;
  updatedAt!: Date;
  children?: GoalResponseDto[];
  // Phase 3
  projectId?: string | null;
}
