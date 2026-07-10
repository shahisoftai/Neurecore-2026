import { IsString, IsOptional, IsEnum,  } from 'class-validator';
import { DepartmentStatus } from '@prisma/client';

export class CreateDepartmentDto {
  @IsString() name!: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(DepartmentStatus) status?: DepartmentStatus;
  @IsOptional() @IsString() headAgentId?: string;
  @IsOptional() @IsString() parentId?: string;
}

export class UpdateDepartmentDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsEnum(DepartmentStatus) status?: DepartmentStatus;
  @IsOptional() @IsString() headAgentId?: string;
  @IsOptional() @IsString() parentId?: string;
}
