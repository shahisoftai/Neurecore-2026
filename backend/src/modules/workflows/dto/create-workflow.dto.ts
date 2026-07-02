/**
 * CreateWorkflowDto — Input validation for workflow creation.
 *
 * SOLID — Interface Segregation: only fields needed for creation.
 */

import {
    IsString,
    IsOptional,
    IsObject,
    IsArray,
    MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWorkflowDto {
    @IsString()
    @MaxLength(200)
    name!: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @IsOptional()
    @IsObject()
    definition?: Record<string, unknown>;

    @IsOptional()
    @IsObject()
    config?: Record<string, unknown>;

    @IsOptional()
    @IsArray()
    nodes?: unknown[];

    @IsOptional()
    @IsArray()
    edges?: unknown[];

    @IsOptional()
    isTemplate?: boolean;
}
