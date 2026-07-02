/**
 * UpdateWorkflowDto — Partial update validation for workflows.
 *
 * SOLID — Interface Segregation: all fields optional (PATCH semantics).
 */

import {
    IsString,
    IsOptional,
    IsObject,
    IsArray,
    IsEnum,
    MaxLength,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { WorkflowStatus } from '@prisma/client';

export class UpdateWorkflowDto {
    @IsOptional()
    @IsString()
    @MaxLength(200)
    name?: string;

    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @IsOptional()
    @IsEnum(WorkflowStatus)
    status?: WorkflowStatus;

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
}
