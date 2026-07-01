/**
 * LLM Client Interface
 *
 * Abstraction layer for LLM providers.
 * Supports: OpenAI, MiniMax, DeepSeek, Xiaomi MiMo (OpenAI-compatible APIs).
 */

import { z } from 'zod';

export type LLMProvider = 'openai' | 'minimax' | 'deepseek' | 'mimo';

export const LLMConfigSchema = z.object({
  provider: z
    .enum(['openai', 'minimax', 'deepseek', 'mimo'])
    .default('minimax'),
  model: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().positive().optional(),
  timeout: z.number().int().positive().optional(),
  streaming: z.boolean().default(false),
});

export type LLMConfig = z.infer<typeof LLMConfigSchema>;

export interface LLMResponse {
  content: string;
  raw: unknown;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface LLMStreamResponse {
  content: string;
  done: boolean;
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface LLMToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

export interface LLMWithToolsResponse {
  content?: string;
  toolCalls?: LLMToolCall[];
  usage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
  finishReason?: string;
}

export interface ILLMClient {
  readonly provider: string;
  readonly model: string;

  invoke(prompt: string, config?: Partial<LLMConfig>): Promise<LLMResponse>;

  invokeStructured<T extends z.ZodSchema>(
    prompt: string,
    schema: T,
    config?: Partial<LLMConfig>,
  ): Promise<z.infer<T>>;

  stream(
    prompt: string,
    config?: Partial<LLMConfig>,
  ): AsyncIterable<LLMStreamResponse>;

  streamStructured<T extends z.ZodSchema>(
    prompt: string,
    schema: T,
    config?: Partial<LLMConfig>,
  ): AsyncIterable<LLMStreamResponse>;

  invokeWithTools(
    messages: Array<{ role: string; content: string }>,
    tools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: {
          type: 'object';
          properties: Record<string, unknown>;
          required: string[];
        };
      };
    }>,
    temperature?: number,
    maxTokens?: number,
  ): Promise<LLMWithToolsResponse>;
}
