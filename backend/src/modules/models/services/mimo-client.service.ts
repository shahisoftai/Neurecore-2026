/**
 * Xiaomi MiMo Client Service
 *
 * OpenAI-compatible client for Xiaomi MiMo LLM API.
 * MiMo is Xiaomi's native language model for agentic tasks.
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
import { readConfig, readConfigOr } from '../../../common/utils/config-getter';

/**
 * MiMo API message format
 */
interface MiMoMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * MiMo API choice format
 */
interface MiMoChoice {
  message: {
    role: string;
    content: string;
  };
  finish_reason: string;
}

/**
 * MiMo API usage format
 */
interface MiMoUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/**
 * MiMo API response format
 */
interface MiMoApiResponse {
  id: string;
  model: string;
  choices: MiMoChoice[];
  usage: MiMoUsage;
  created?: number;
}

/**
 * MiMo streaming chunk format
 */
interface MiMoStreamChunk {
  id: string;
  model: string;
  choices: Array<{
    delta: {
      content?: string;
      role?: string;
    };
    finish_reason?: string;
  }>;
  usage?: MiMoUsage;
}

@Injectable()
export class MiMoClientService implements ILLMClient {
  readonly provider = 'mimo';
  readonly model: string;

  private readonly logger = new Logger(MiMoClientService.name);
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly organizationId?: string;

  constructor(private readonly config?: ConfigService) {
    this.apiKey = readConfigOr(config, 'MIMO_API_KEY', '');
    this.baseUrl = readConfigOr(
      config,
      'MIMO_BASE_URL',
      'https://api.mimo.ai/v1',
    );
    this.model = readConfigOr(config, 'MIMO_MODEL', 'MiMo-72B-Instruct');
    this.organizationId = readConfig(config, 'MIMO_ORG_ID');

    if (!this.apiKey) {
      this.logger.warn(
        'MIMO_API_KEY not configured. MiMo client will use stub responses.',
        MiMoClientService.name,
      );
    } else {
      this.logger.log(`MiMo client initialized with model: ${this.model}`);
    }
  }

  isConfigured(): boolean {
    return this.apiKey.length > 0;
  }

  async invoke(
    prompt: string,
    config?: Partial<LLMConfig>,
  ): Promise<LLMResponse> {
    const temperature = config?.temperature ?? 0.7;
    const maxTokens = config?.maxTokens ?? 2048;
    const model = config?.model ?? this.model;

    if (!this.isConfigured()) {
      return this.stubResponse(prompt);
    }

    try {
      const messages: MiMoMessage[] = [{ role: 'user', content: prompt }];

      const response = await this.makeRequest({
        model,
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
      this.logger.error(`MiMo invoke failed: ${error}`, MiMoClientService.name);
      throw error;
    }
  }

  async invokeStructured<T extends z.ZodSchema>(
    prompt: string,
    schema: T,
    config?: Partial<LLMConfig>,
  ): Promise<z.infer<T>> {
    const temperature = config?.temperature ?? 0.2;
    const maxTokens = config?.maxTokens ?? 2048;
    const model = config?.model ?? this.model;

    if (!this.isConfigured()) {
      const emptyResult: z.infer<T> = {} as z.infer<T>;
      return emptyResult;
    }

    try {
      const messages: MiMoMessage[] = [
        {
          role: 'system',
          content:
            'You are a structured output assistant. Respond with valid JSON only that matches the requested schema.',
        },
        { role: 'user', content: prompt },
      ];

      const response = await this.makeRequest({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      });

      const content = response.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as unknown;
      const result: z.infer<T> = schema.parse(parsed);
      return result;
    } catch (error) {
      this.logger.error(
        `MiMo structured invoke failed: ${error}`,
        MiMoClientService.name,
      );
      throw error;
    }
  }

  async *stream(
    prompt: string,
    config?: Partial<LLMConfig>,
  ): AsyncGenerator<LLMStreamResponse> {
    const temperature = config?.temperature ?? 0.7;
    const maxTokens = config?.maxTokens ?? 2048;
    const model = config?.model ?? this.model;

    if (!this.isConfigured()) {
      yield { content: `Stub: ${prompt.slice(0, 50)}...`, done: true };
      return;
    }

    const messages: MiMoMessage[] = [{ role: 'user', content: prompt }];

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          ...(this.organizationId && {
            'MiMo-Organization': this.organizationId,
          }),
        },
        body: JSON.stringify({
          model,
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`MiMo API error: ${response.status} ${errorText}`);
      }

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
              const parsed = JSON.parse(data) as MiMoStreamChunk;
              const content = parsed.choices?.[0]?.delta?.content ?? '';
              if (content) {
                yield { content, done: false };
              }
            } catch {
              // Skip invalid JSON lines
            }
          }
        }
      }

      yield { content: '', done: true };
    } catch (error) {
      this.logger.error(`MiMo stream failed: ${error}`, MiMoClientService.name);
      throw error;
    }
  }

  async *streamStructured<T extends z.ZodSchema>(
    prompt: string,
    schema: T,
    config?: Partial<LLMConfig>,
  ): AsyncGenerator<LLMStreamResponse> {
    // For structured streaming, we accumulate the full response
    // then parse at the end since MiMo doesn't support partial JSON streaming
    let fullContent = '';

    for await (const chunk of this.stream(prompt, {
      ...config,
      temperature: config?.temperature ?? 0.2,
    })) {
      if (chunk.done) {
        // Parse the accumulated structured content
        try {
          const parsed = JSON.parse(fullContent) as unknown;
          const validated: z.infer<T> = schema.parse(parsed);
          yield {
            content: JSON.stringify(validated),
            done: true,
          };
        } catch {
          yield { content: fullContent, done: true };
        }
        return;
      }

      fullContent += chunk.content;
      // Yield the raw chunk for streaming display
      yield { content: chunk.content, done: false };
    }
  }

  private async makeRequest(
    body: Record<string, unknown>,
  ): Promise<MiMoApiResponse> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${this.apiKey}`,
    };

    if (this.organizationId) {
      headers['MiMo-Organization'] = this.organizationId;
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`MiMo API error: ${response.status} ${errorText}`);
    }

    return response.json() as Promise<MiMoApiResponse>;
  }

  private stubResponse(prompt: string): LLMResponse {
    this.logger.warn(
      'MiMo not configured, returning stub response',
      MiMoClientService.name,
    );
    return {
      content: `MiMo stub response for: ${prompt.slice(0, 100)}...`,
      raw: { stub: true, provider: 'mimo' },
      usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
      finishReason: 'stop',
    };
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
  ): Promise<
    import('../interfaces/llm-client.interface').LLMWithToolsResponse
  > {
    throw new Error('invokeWithTools not implemented for MiMo');
  }
}
