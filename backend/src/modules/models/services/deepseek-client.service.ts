/**
 * DeepSeek Client Service
 *
 * OpenAI-compatible client for DeepSeek models.
 * Strong for deep reasoning and complex logical tasks.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  ILLMClient,
  LLMResponse,
  LLMStreamResponse,
  LLMConfig,
} from '../interfaces/llm-client.interface';
import { readConfigOr } from '../../../common/utils/config-getter';

@Injectable()
export class DeepSeekClientService implements ILLMClient {
  readonly provider = 'deepseek';
  readonly model = 'deepseek-chat';

  private readonly logger = new Logger(DeepSeekClientService.name);
  private readonly baseUrl = 'https://api.deepseek.com/v1';
  private readonly apiKey: string;

  constructor(private readonly config?: ConfigService) {
    this.apiKey = readConfigOr(config, 'DEEPSEEK_API_KEY', '');
    if (!this.apiKey) {
      this.logger.warn('DEEPSEEK_API_KEY not configured');
    }
  }

  async invoke(
    prompt: string,
    config?: Partial<LLMConfig>,
  ): Promise<LLMResponse> {
    const model = config?.model ?? this.model;
    const temperature = config?.temperature ?? 0.7;
    const maxTokens = config?.maxTokens ?? 1024;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        this.logger.error(`DeepSeek API error: ${response.status} - ${error}`);
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{
          message?: { content?: string };
          finish_reason?: string;
        }>;
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
      return {
        content: data.choices?.[0]?.message?.content ?? '',
        raw: data,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
          totalTokens: data.usage?.total_tokens ?? 0,
        },
        finishReason: data.choices?.[0]?.finish_reason,
      };
    } catch (error) {
      this.logger.error(`DeepSeek invoke error: ${error}`);
      throw error;
    }
  }

  async invokeStructured<T extends z.ZodSchema>(
    prompt: string,
    schema: T,
    config?: Partial<LLMConfig>,
  ): Promise<z.infer<T>> {
    const response = await this.invoke(prompt, {
      ...config,
      temperature: config?.temperature ?? 0.3, // Lower temp for structured output
    });

    try {
      const parsed = JSON.parse(response.content) as unknown;
      return schema.parse(parsed);
    } catch (parseError) {
      this.logger.warn(`Failed to parse structured output: ${parseError}`);
      return response.content as unknown as z.infer<T>;
    }
  }

  async *stream(
    prompt: string,
    config?: Partial<LLMConfig>,
  ): AsyncGenerator<LLMStreamResponse> {
    const model = config?.model ?? this.model;
    const temperature = config?.temperature ?? 0.7;
    const maxTokens = config?.maxTokens ?? 1024;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`DeepSeek API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') {
              yield { content: '', done: true };
              return;
            }
            try {
              const parsed = JSON.parse(data) as {
                choices?: Array<{ delta?: { content?: string } }>;
                usage?: {
                  prompt_tokens?: number;
                  completion_tokens?: number;
                  total_tokens?: number;
                };
              };
              const content = parsed.choices?.[0]?.delta?.content ?? '';
              if (content) {
                yield {
                  content,
                  done: false,
                  usage: {
                    inputTokens: parsed.usage?.prompt_tokens ?? 0,
                    outputTokens: parsed.usage?.completion_tokens ?? 0,
                    totalTokens: parsed.usage?.total_tokens ?? 0,
                  },
                };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      yield { content: '', done: true };
    } catch (error) {
      this.logger.error(`DeepSeek stream error: ${error}`);
      throw error;
    }
  }

  async *streamStructured<T extends z.ZodSchema>(
    prompt: string,
    schema: T,
    config?: Partial<LLMConfig>,
  ): AsyncGenerator<LLMStreamResponse> {
    let fullContent = '';

    for await (const chunk of this.stream(prompt, config)) {
      fullContent += chunk.content;
      yield chunk;
    }

    // Validate the streamed content against the schema
    try {
      const parsed = JSON.parse(fullContent) as unknown;
      schema.parse(parsed);
    } catch {
      this.logger.warn('Streamed content is not valid structured output');
    }
  }

  async invokeWithTools(
    _messages: Array<{ role: string; content: string }>,
    _tools: Array<{
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
    _temperature?: number,
    _maxTokens?: number,
  ): Promise<import('../interfaces/llm-client.interface').LLMWithToolsResponse> {
    throw new Error('invokeWithTools not implemented for DeepSeek');
  }
}
