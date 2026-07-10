import { IsString, IsOptional, IsArray, ValidateNested, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export class CosMessageHistory {
  @IsString()
  role!: 'user' | 'assistant' | 'system';

  @IsString()
  content!: string;
}

export class SendCosMessageDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CosMessageHistory)
  history?: CosMessageHistory[];
}

export class CosResponseDto {
  reply!: string;
  conversationId!: string;
  tokens?: { input: number; output: number; total: number };
  model?: string;
  provider?: string;
  projectSnapshot?: ProjectCosSnapshot;
}

export interface ProjectCosSnapshot {
  projectId: string;
  name: string;
  status: string;
  healthScore: number | null;
  completenessScore: number;
  activeGoals: number;
  completedGoals: number;
  openTasks: number;
  completedTasks: number;
  currentStage: string | null;
  recentMemories: Array<{ category: string; content: string; createdAt: string }>;
}
