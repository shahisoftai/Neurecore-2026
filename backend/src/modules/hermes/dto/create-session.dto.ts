import { IsString, IsOptional, IsObject } from 'class-validator';

export class CreateSessionDto {
  @IsString()
  hermesAgentId!: string;

  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;
}

export class AddMessageDto {
  @IsString()
  role!: string;

  @IsString()
  content!: string;

  @IsOptional()
  @IsObject()
  toolCalls?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  toolResults?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  error?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class ExecuteTaskDto {
  @IsString()
  task!: string;

  @IsOptional()
  tools?: string[];

  @IsOptional()
  maxIterations?: number;

  @IsOptional()
  temperature?: number;
}
