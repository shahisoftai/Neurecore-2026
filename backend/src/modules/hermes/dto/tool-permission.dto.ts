/**
 * tool-permission.dto.ts — DTO for granting/revoking tool permissions on a Hermes agent.
 *
 * SOLID — SRP: Only tool permission mutation input.
 */

import { IsString, IsEnum, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ToolPermissionLevel } from '@prisma/client';

export class ToolPermissionDto {
    @ApiProperty({ description: 'Name of the tool to configure' })
    @IsString()
    toolName!: string;

    @ApiProperty({ enum: ToolPermissionLevel })
    @IsEnum(ToolPermissionLevel)
    permission!: ToolPermissionLevel;

    @ApiPropertyOptional({
        description: 'Conditional permission rules, e.g. { maxPerDay: 10, requiresApproval: true }',
    })
    @IsOptional()
    @IsObject()
    conditions?: Record<string, unknown>;
}
