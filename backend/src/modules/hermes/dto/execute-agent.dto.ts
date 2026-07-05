import { IsString, IsOptional, IsObject } from 'class-validator';

export class ExecuteAgentDto {
  @IsString()
  agentId!: string;

  @IsString()
  task!: string;

  @IsString()
  @IsOptional()
  userId?: string;

  @IsString()
  @IsOptional()
  sessionId?: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}
