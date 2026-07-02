/**
 * approval-workflow.dto.ts — DTOs for creating and advancing approval workflows.
 *
 * SOLID — SRP: Only approval workflow input validation.
 */

import {
    IsString,
    IsEnum,
    IsOptional,
    IsArray,
    IsInt,
    IsObject,
    ValidateNested,
    Min,
    MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApprovalWorkflowType, UserRole } from '@prisma/client';

export class ApprovalWorkflowStepDto {
    @ApiProperty()
    @IsInt()
    @Min(0)
    stepOrder!: number;

    @ApiProperty({ type: [String], enum: UserRole })
    @IsArray()
    @IsEnum(UserRole, { each: true })
    approverRole!: UserRole[];

    @ApiPropertyOptional({ description: 'Specific user ID override for this step' })
    @IsOptional()
    @IsString()
    approverId?: string;
}

export class CreateApprovalWorkflowDto {
    @ApiProperty()
    @IsString()
    @MaxLength(200)
    name!: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    description?: string;

    @ApiProperty({ enum: ApprovalWorkflowType })
    @IsEnum(ApprovalWorkflowType)
    workflowType!: ApprovalWorkflowType;

    @ApiProperty({ type: [ApprovalWorkflowStepDto] })
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ApprovalWorkflowStepDto)
    steps!: ApprovalWorkflowStepDto[];

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    context?: Record<string, unknown>;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    workspaceId?: string;

    @ApiPropertyOptional({ description: 'LangGraph RoutineRun ID to resume on completion' })
    @IsOptional()
    @IsString()
    routineRunId?: string;
}

export class AdvanceWorkflowStepDto {
    @ApiProperty({ enum: ['APPROVED', 'REJECTED', 'SKIPPED'] })
    @IsEnum(['APPROVED', 'REJECTED', 'SKIPPED'])
    decision!: 'APPROVED' | 'REJECTED' | 'SKIPPED';

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    comment?: string;
}
