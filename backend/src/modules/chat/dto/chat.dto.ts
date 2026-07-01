import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsObject,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryMessage {
  @IsString()
  role!: 'system' | 'user' | 'assistant';

  @IsString()
  content!: string;
}

export class ChatContextEntry {
  [key: string]: unknown;
}

export class SendChatMessageDto {
  @IsString()
  @MaxLength(4000)
  message!: string;

  @IsOptional()
  @IsString()
  conversationId?: string;

  @IsOptional()
  @IsString()
  systemPrompt?: string;

  @IsOptional()
  @IsNumber()
  temperature?: number;

  @IsOptional()
  @IsNumber()
  maxTokens?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChatHistoryMessage)
  history?: ChatHistoryMessage[];

  @IsOptional()
  @IsObject()
  context?: ChatContextEntry;
}

export class ChatResponseDto {
  reply!: string;
  conversationId!: string;
  tokens?: {
    input: number;
    output: number;
    total: number;
  };
  model?: string;
  provider?: string;
}
