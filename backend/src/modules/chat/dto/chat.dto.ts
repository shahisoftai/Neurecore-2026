import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumber,
  IsObject,
  MaxLength,
  Min,
  Max,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ChatHistoryMessage {
  @IsString()
  role!: 'system' | 'user' | 'assistant';

  @IsString()
  @MaxLength(8000)
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
  @MaxLength(128)
  conversationId?: string;

  // Phase 3.8: disallow caller-supplied system prompts. They bypass
  // our per-tenant prompt assembly and can leak the live-data snapshot
  // structure to other tenants. The chat service constructs its own
  // system prompt from the tenant context.
  //
  // The field is preserved (as @IsOptional) so existing clients don't
  // crash on send; it's silently ignored.

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(2)
  temperature?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(32_000)
  maxTokens?: number;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(40)
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
