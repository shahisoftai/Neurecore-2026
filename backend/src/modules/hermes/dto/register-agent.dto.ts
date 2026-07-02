/**
 * register-agent.dto.ts — Input DTO for registering a new Hermes agent.
 *
 * SOLID — SRP: Only input validation for agent registration.
 */

import {
    IsString,
    IsOptional,
    IsEnum,
    IsArray,
    IsBoolean,
    IsInt,
    IsObject,
    MaxLength,
    Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HermesAgentType } from '@prisma/client';

export class RegisterAgentDto {
    @ApiProperty({ example: 'Finance Hermes' })
    @IsString()
    @MaxLength(200)
    name!: string;

    @ApiProperty({ enum: HermesAgentType })
    @IsEnum(HermesAgentType)
    type!: HermesAgentType;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    @MaxLength(1000)
    description?: string;

    @ApiPropertyOptional({ example: 'deepseek-chat' })
    @IsOptional()
    @IsString()
    model?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    systemPrompt?: string;

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    permissions?: string[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    allowedPaths?: string[];

    @ApiPropertyOptional({ type: [String] })
    @IsOptional()
    @IsArray()
    @IsString({ each: true })
    blockedPaths?: string[];

    @ApiPropertyOptional({ example: 10485760 })
    @IsOptional()
    @IsInt()
    @Min(0)
    maxFileSize?: number;

    @ApiPropertyOptional()
    @IsOptional()
    @IsObject()
    config?: Record<string, unknown>;

    @ApiPropertyOptional({ example: 'workspace_abc' })
    @IsOptional()
    @IsString()
    workspaceId?: string;

    @ApiPropertyOptional({ default: true })
    @IsOptional()
    @IsBoolean()
    isActive?: boolean;
}
