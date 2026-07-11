/**
 * AI Gateway — Domain DTOs and types
 *
 * DTOs are TS interfaces. Zod schemas live in `invoke-options.ts` and
 * are applied at the public service boundary.
 *
 * SOLID: DIP — downstream code depends on these types, not on
 * concrete provider classes or Prisma models.
 */

import type { Capability } from './capabilities';

export type ChatRole = 'system' | 'user' | 'assistant' | 'tool';

export interface ChatMessage {
  role: ChatRole;
  content: string;
  name?: string;
  toolCallId?: string;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface LLMToolCall {
  id: string;
  name: string;
  arguments: unknown;
  result?: unknown;
}

export interface LLMResponse {
  content: string;
  usage: LLMUsage;
  model: string;
  provider: string;
  latencyMs: number;
  resolved: {
    providerId: string;
    aiModelId: string;
    capability: Capability;
  };
}

export interface LLMStreamChunk {
  delta: string;
  done: boolean;
  usage?: LLMUsage;
  model?: string;
  provider?: string;
}

export interface LLMToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  requiredPermissions?: string[];
}

export interface ResolvedModel {
  provider: {
    id: string;
    slug: string;
    name: string;
    apiBaseUrl: string;
  };
  model: {
    id: string;
    modelId: string;
    displayName: string;
    contextWindow: number;
    costPer1kInput: number;
    costPer1kOutput: number;
  };
  apiKey: string;
  overrides: {
    viaTenant: boolean;
    viaFallback: boolean;
  };
}

export interface SelectOptions {
  preferSpeed?: boolean;
  budgetCents?: number;
  estTokens?: number;
  modelId?: string;
}
