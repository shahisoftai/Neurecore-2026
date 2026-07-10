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
  @IsString()
  parentId?: string;

  @IsOptional()
  @IsString()
  ownerAgentId?: string;

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  // Phase 3
  @IsOptional()
  @IsString()
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
  @IsString()
  parentId?: string | null;

  @IsOptional()
  @IsString()
  ownerAgentId?: string | null;

  @IsOptional()
  @IsString()
  ownerUserId?: string | null;

  @IsOptional()
  @IsString()
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
  @IsString()
  parentId?: string | 'root';

  @IsOptional()
  @IsString()
  ownerUserId?: string;

  @IsOptional()
  @IsString()
  ownerAgentId?: string;

  // Phase 3
  @IsOptional()
  @IsString()
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
