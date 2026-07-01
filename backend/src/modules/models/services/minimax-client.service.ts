/**
 * MiniMax Client Service
 *
 * OpenAI-compatible client for MiniMax LLM API.
 * MiniMax uses the same API format as OpenAI but with different endpoint.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  LLMResponse,
  LLMStreamResponse,
  LLMWithToolsResponse,
  LLMToolCall,
} from '../interfaces/llm-client.interface';
import { readConfigOr } from '../../../common/utils/config-getter';

/**
 * MiniMax API response types
 */
interface MiniMaxMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface MiniMaxChoice {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

interface MiniMaxUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

interface MiniMaxApiResponse {
  id: string;
  model: string;
  choices: MiniMaxChoice[];
  usage: MiniMaxUsage;
}

@Injectable()
export class MiniMaxClient {
  readonly provider = 'minimax';
  readonly model: string;

  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config?: ConfigService) {
    this.apiKey = readConfigOr(config, 'MINIMAX_API_KEY', '');
    this.baseUrl = readConfigOr(
      config,
      'MINIMAX_BASE_URL',
      'https://api.minimaxi.com/v1',
    );
    this.model = readConfigOr(config, 'MINIMAX_MODEL', 'MiniMax-M2.5');

    if (!this.apiKey) {
      Logger.warn(
        'MINIMAX_API_KEY not configured. MiniMax client will use stub responses.',
        MiniMaxClient.name,
      );
    }
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async invoke(
    prompt: string,
    temperature = 0.7,
    maxTokens = 1024,
  ): Promise<LLMResponse> {
    if (!this.isConfigured()) {
      return this.stubResponse(prompt);
    }

    try {
      const messages: MiniMaxMessage[] = [{ role: 'user', content: prompt }];

      const response = await this.makeRequest({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const choice = response.choices[0];
      const usage = response.usage;

      return {
        content: choice.message.content,
        raw: response,
        usage: {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      Logger.error(`MiniMax invoke failed: ${error}`, MiniMaxClient.name);
      throw error;
    }
  }

  async invokeStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    temperature = 0.2,
    maxTokens = 2048,
  ): Promise<T> {
    if (!this.isConfigured()) {
      return {} as T;
    }

    try {
      const messages: MiniMaxMessage[] = [
        {
          role: 'system',
          content:
            'You are a structured output assistant. Respond with valid JSON only.',
        },
        { role: 'user', content: prompt },
      ];

      const response = await this.makeRequest({
        model: this.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as T;
      return schema.parse(parsed);
    } catch (error) {
      Logger.error(
        `MiniMax structured invoke failed: ${error}`,
        MiniMaxClient.name,
      );
      throw error;
    }
  }

  async *stream(
    prompt: string,
    temperature = 0.7,
    maxTokens = 1024,
  ): AsyncIterable<LLMStreamResponse> {
    if (!this.isConfigured()) {
      yield { content: `Stub: ${prompt.slice(0, 50)}...`, done: true };
      return;
    }

    const messages: MiniMaxMessage[] = [{ role: 'user', content: prompt }];

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
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
              };
              const content = parsed.choices?.[0]?.delta?.content ?? '';
              if (content) {
                yield { content, done: false };
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }

      yield { content: '', done: true };
    } catch (error) {
      Logger.error(`MiniMax stream failed: ${error}`, MiniMaxClient.name);
      throw error;
    }
  }

  async invokeWithTools(
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
    temperature = 0.3,
    maxTokens = 2048,
  ): Promise<LLMWithToolsResponse> {
    if (!this.isConfigured()) {
      return {
        content: 'MiniMax is not configured.',
        toolCalls: [],
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        finishReason: 'stop',
      };
    }

    try {
      const response = await this.makeRequest({
        model: this.model,
        messages,
        tools,
        tool_choice: 'auto',
        temperature,
        max_tokens: maxTokens,
      } as Record<string, unknown>);

      const choice = response.choices[0];
      const usage = response.usage;

      const toolCalls: LLMToolCall[] = [];
      const rawToolCalls = (choice.message as any).tool_calls ?? [];
      for (const tc of rawToolCalls) {
        toolCalls.push({
          name: tc.function?.name ?? tc.name ?? '',
          arguments: JSON.parse(tc.function?.arguments ?? '{}'),
        });
      }

      return {
        content: choice.message.content || undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      Logger.error(`MiniMax invokeWithTools failed: ${error}`, MiniMaxClient.name);
      throw error;
    }
  }

  private async makeRequest(
    body: Record<string, unknown>,
  ): Promise<MiniMaxApiResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiniMax API error: ${response.status} ${errorText}`);
    }

    return response.json() as Promise<MiniMaxApiResponse>;
  }

  private stubResponse(prompt: string): LLMResponse {
    Logger.warn(
      'MiniMax not configured, returning stub response',
      MiniMaxClient.name,
    );
    return {
      content: `Stub response for: ${prompt.slice(0, 100)}...`,
      raw: { stub: true },
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    };
  }
}
