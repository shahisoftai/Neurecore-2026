/**
 * LLM Factory Service
 *
 * Factory for creating LLM clients. Selects between OpenAI, MiniMax, DeepSeek, and MiMo based on configuration.
 */

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { z } from 'zod';
import {
  LLMResponse,
  LLMStreamResponse,
  LLMWithToolsResponse,
} from '../interfaces/llm-client.interface';
import { ModelRoutingService, ModelSpec } from './model-routing.service';
import { MiMoClientService } from './mimo-client.service';

export type LLMProvider = 'openai' | 'minimax' | 'deepseek' | 'mimo';

@Injectable()
export class LLMFactory {
  private readonly logger = new Logger(LLMFactory.name);

  constructor(
    private readonly config: ConfigService,
    private readonly modelRouting: ModelRoutingService,
    private readonly mimoClient: MiMoClientService,
  ) {}

  /**
   * Get the default provider based on environment configuration
   *
   * Provider Priority:
   * 1. MiniMax (default, fast for simple tasks)
   * 2. DeepSeek (strong reasoning)
   * 3. Xiaomi MiMo (balanced for agentic tasks)
   * 4. OpenAI (fallback)
   */
  getDefaultProvider(): LLMProvider {
    const preferred = this.config.get<LLMProvider>('LLM_PROVIDER') ?? 'minimax';

    // Check if preferred provider has API key
    if (preferred === 'minimax') {
      const apiKey = this.config.get<string>('MINIMAX_API_KEY');
      if (apiKey) return 'minimax';
      this.logger.warn('MINIMAX_API_KEY not set');
    }

    if (preferred === 'deepseek') {
      const apiKey = this.config.get<string>('DEEPSEEK_API_KEY');
      if (apiKey) return 'deepseek';
      this.logger.warn('DEEPSEEK_API_KEY not set');
    }

    if (preferred === 'mimo') {
      const apiKey = this.config.get<string>('MIMO_API_KEY');
      if (apiKey) return 'mimo';
      this.logger.warn('MIMO_API_KEY not set');
    }

    // OpenAI check
    const openaiKey = this.config.get<string>('OPENAI_API_KEY');
    if (openaiKey) {
      this.logger.log('Falling back to OpenAI');
      return 'openai';
    }

    // Ultimate fallback to minimax
    this.logger.warn('No API keys found, defaulting to MiniMax');
    return 'minimax';
  }

  /**
   * Select the best model for a task
   *
   * Model Selection Strategy:
   * - 'planning' (high complexity) → DeepSeek (reasoning)
   * - 'evaluation' (high complexity) → DeepSeek (reasoning)
   * - 'execution' (medium) → MiniMax (balanced)
   * - 'coding' (medium-high) → MiniMax or DeepSeek
   * - 'conversation' (low) → MiniMax (fast)
   */
  selectModel(
    taskType:
      | 'planning'
      | 'execution'
      | 'evaluation'
      | 'conversation'
      | 'coding'
      | 'reasoning',
    complexity: 'low' | 'medium' | 'high' = 'medium',
  ): { provider: LLMProvider; model: ModelSpec } {
    const provider = this.getDefaultProvider();

    // Task-specific model routing — MiniMax-M2.7-highspeed preferred for all
    const taskModelMap: Record<
      string,
      { provider: LLMProvider; complexity: 'low' | 'medium' | 'high' }
    > = {
      reasoning: { provider: 'minimax', complexity: 'high' },
      planning: { provider: 'minimax', complexity: 'high' },
      evaluation: { provider: 'minimax', complexity: 'high' },
      coding: { provider: 'minimax', complexity: 'high' },
      execution: { provider: 'minimax', complexity: 'medium' },
      conversation: { provider: 'minimax', complexity: 'low' },
    };

    const routing = taskModelMap[taskType] || {
      provider: 'minimax',
      complexity: 'medium',
    };

    // Get models for the target provider
    let targetModels = this.modelRouting
      .getAvailableModels()
      .filter(
        (m) =>
          m.provider === routing.provider && m.capabilities.includes(taskType),
      );

    // Prefer MiniMax-M2.7-highspeed if available
    if (routing.provider === 'minimax') {
      const highspeedIdx = targetModels.findIndex(
        (m) => m.id === 'MiniMax-M2.7-highspeed',
      );
      if (highspeedIdx > 0) {
        targetModels = [
          targetModels[highspeedIdx],
          ...targetModels.slice(0, highspeedIdx),
          ...targetModels.slice(highspeedIdx + 1),
        ];
      }
    }

    if (targetModels.length > 0) {
      const model = targetModels[0];
      this.logger.log(
        `Selected ${routing.provider} model: ${model.id} for ${taskType}`,
      );
      return { provider: routing.provider, model };
    }

    // Fallback: use model routing service
    const result = this.modelRouting.selectModel({
      taskType,
      complexity: routing.complexity,
      preferSpeed: taskType === 'conversation',
    });

    this.logger.log(
      `Selected ${result.recommended.provider} model: ${result.recommended.id} for ${taskType}`,
    );
    return {
      provider: result.recommended.provider as LLMProvider,
      model: result.recommended,
    };
  }

  /**
   * Invoke LLM with plain text response
   */
  async invoke(
    prompt: string,
    params?: {
      provider?: LLMProvider;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): Promise<LLMResponse> {
    const provider = params?.provider ?? this.getDefaultProvider();
    const temperature = params?.temperature ?? 0.7;
    const maxTokens = params?.maxTokens ?? 1024;

    let modelId = params?.model;
    if (!modelId) {
      const selected = this.selectModel('conversation');
      modelId = selected.model.id;
    }

    const apiKey =
      provider === 'minimax'
        ? (this.config.get<string>('MINIMAX_API_KEY') ?? '')
        : provider === 'openai'
          ? (this.config.get<string>('OPENAI_API_KEY') ?? '')
          : provider === 'deepseek'
            ? (this.config.get<string>('DEEPSEEK_API_KEY') ?? '')
            : (this.config.get<string>('MIMO_API_KEY') ?? '');
    const baseUrl = resolveBaseUrl(provider, this.config);

    if (!apiKey) {
      return {
        content: `Stub: ${prompt.slice(0, 100)}...`,
        raw: { stub: true },
        usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        finishReason: 'stop',
      };
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${provider} API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string }; finish_reason: string }>;
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      return {
        content: data.choices[0]?.message?.content ?? '',
        raw: data,
        usage: {
          inputTokens: data.usage.prompt_tokens,
          outputTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        },
        finishReason: data.choices[0]?.finish_reason,
      };
    } catch (error) {
      this.logger.error(`LLM invoke failed: ${error}`);
      throw error;
    }
  }

  /**
   * Invoke LLM with structured output (Zod schema)
   */
  async invokeStructured<T>(
    prompt: string,
    schema: z.ZodSchema<T>,
    params?: {
      provider?: LLMProvider;
      model?: string;
      maxTokens?: number;
    },
  ): Promise<T> {
    const provider = params?.provider ?? this.getDefaultProvider();
    const maxTokens = params?.maxTokens ?? 2048;

    let modelId = params?.model;
    if (!modelId) {
      const selected = this.selectModel('planning');
      modelId = selected.model.id;
    }

    const apiKey = resolveApiKey(provider, this.config);
    const baseUrl = resolveBaseUrl(provider, this.config);

    if (!apiKey) {
      return {} as T;
    }

    try {
      const messages = [
        {
          role: 'system' as const,
          content:
            'You are a structured output assistant. Respond with valid JSON only.',
        },
        { role: 'user' as const, content: prompt },
      ];

      const body: Record<string, unknown> = {
        model: modelId,
        messages,
        temperature: 0.2,
        max_tokens: maxTokens,
      };

      body.response_format = { type: 'json_object' };

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${provider} API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices[0]?.message?.content ?? '{}';
      const parsed = JSON.parse(content) as T;
      return schema.parse(parsed);
    } catch (error) {
      this.logger.error(`LLM structured invoke failed: ${error}`);
      throw error;
    }
  }

  /**
   * Stream LLM response
   */
  async *stream(
    prompt: string,
    params?: {
      provider?: LLMProvider;
      model?: string;
      temperature?: number;
      maxTokens?: number;
    },
  ): AsyncIterable<LLMStreamResponse> {
    const provider = params?.provider ?? this.getDefaultProvider();
    const temperature = params?.temperature ?? 0.7;
    const maxTokens = params?.maxTokens ?? 1024;

    let modelId = params?.model;
    if (!modelId) {
      const selected = this.selectModel('conversation');
      modelId = selected.model.id;
    }

    const apiKey = resolveApiKey(provider, this.config);
    const baseUrl = resolveBaseUrl(provider, this.config);

    if (!apiKey) {
      yield { content: `Stub: ${prompt.slice(0, 50)}...`, done: true };
      return;
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: prompt }],
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
      this.logger.error(`LLM stream failed: ${error}`);
      throw error;
    }
  }

  /**
   * Invoke LLM with tool/function calling support
   */
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
    overrideModel?: string,
  ): Promise<LLMWithToolsResponse> {
    const provider = this.getDefaultProvider();
    let modelId = overrideModel;
    if (!modelId) {
      const selected = this.selectModel('execution');
      modelId = selected.model.id;
    }

    const apiKey = resolveApiKey(provider, this.config);
    const baseUrl = resolveBaseUrl(provider, this.config);

    if (!apiKey) {
      throw new Error(
        `No API key configured for provider ${provider}. ` +
          `Set the matching env var (MINIMAX_API_KEY / OPENAI_API_KEY / DEEPSEEK_API_KEY / MIMO_API_KEY).`,
      );
    }

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages,
          tools,
          tool_choice: 'auto',
          temperature,
          max_tokens: maxTokens,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`${provider} API error: ${response.status} ${error}`);
      }

      const data = (await response.json()) as {
        choices: Array<{
          message: {
            content: string | null;
            tool_calls?: Array<{
              id: string;
              type: string;
              function: { name: string; arguments: string };
            }>;
          };
          finish_reason: string;
        }>;
        usage: {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
      };

      const choice = data.choices[0];
      const usage = data.usage;

      const toolCalls = (choice.message.tool_calls ?? []).map((tc) => ({
        name: tc.function.name,
        arguments: JSON.parse(tc.function.arguments) as Record<string, unknown>,
      }));

      return {
        content: choice.message.content ?? undefined,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        usage: {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        },
        finishReason: choice.finish_reason,
      };
    } catch (error) {
      this.logger.error(`LLM invokeWithTools failed: ${error}`);
      throw error;
    }
  }
}

// ───────────────────────────────────────────────────────────────────
// F5 + F6 helpers
//
// Single source of truth for "provider X → base URL / env var name".
// Eliminates the 4× duplicated `https://api.minimax.chat/v1` literal
// and the silent `deepseek`/`mimo` fall-through in `invokeWithTools`.
// SOLID: SRP — pure functions, no side effects, no NestJS injection.
// ───────────────────────────────────────────────────────────────────

const PROVIDER_BASE_URLS: Record<LLMProvider, string> = {
  minimax: 'https://api.minimaxi.com/v1',
  openai: 'https://api.openai.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  mimo: 'https://api.mimo.ai/v1',
};

const PROVIDER_ENV_KEYS: Record<LLMProvider, string> = {
  minimax: 'MINIMAX_API_KEY',
  openai: 'OPENAI_API_KEY',
  deepseek: 'DEEPSEEK_API_KEY',
  mimo: 'MIMO_API_KEY',
};

export function resolveBaseUrl(
  provider: LLMProvider,
  config: ConfigService,
): string {
  const fromEnv =
    provider === 'minimax'
      ? config.get<string>('MINIMAX_BASE_URL')
      : provider === 'deepseek'
        ? config.get<string>('DEEPSEEK_BASE_URL')
        : provider === 'mimo'
          ? config.get<string>('MIMO_BASE_URL')
          : undefined;
  return fromEnv || PROVIDER_BASE_URLS[provider];
}

export function resolveApiKey(
  provider: LLMProvider,
  config: ConfigService,
): string {
  return config.get<string>(PROVIDER_ENV_KEYS[provider]) ?? '';
}
