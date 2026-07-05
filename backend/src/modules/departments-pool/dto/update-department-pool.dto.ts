/**
 * UpdateDepartmentPoolDto — Phase 10 Departments Pool.
 */

import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { DeptPoolStructureItemDto } from './create-department-pool.dto';

export class UpdateDepartmentPoolDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DeptPoolStructureItemDto)
  structure?: DeptPoolStructureItemDto[];

  @IsOptional()
  @IsString()
  @Length(0, 60)
  category?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
