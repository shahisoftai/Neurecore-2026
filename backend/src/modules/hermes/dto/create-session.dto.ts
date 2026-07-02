/**
 * create-session.dto.ts — Input DTO for creating a Hermes conversation session.
 *
 * SOLID — SRP: Only input validation for session creation.
 */

import { IsString, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSessionDto {
    @ApiProperty({ description: 'ID of the Hermes agent to start a session with' })
    @IsString()
    hermesAgentId!: string;

    @ApiPropertyOptional({ description: 'Optional workspace isolation scope' })
    @IsOptional()
    @IsString()
    workspaceId?: string;
}
