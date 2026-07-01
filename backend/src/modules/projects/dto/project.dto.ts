/**
 * Projects Module - DTOs
 *
 * Data Transfer Objects for validation
 */

import { IsString, IsOptional, IsDateString, IsArray } from 'class-validator';

export class CreateProjectDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalIds?: string[];
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsDateString()
  targetDate?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  goalIds?: string[];

  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class ListProjectsDto {
  @IsOptional()
  @IsString()
  status?: 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

  @IsOptional()
  @IsString()
  departmentId?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  page?: string;

  @IsOptional()
  @IsString()
  limit?: string;
}
