// ─── ChatService.ts ─────────────────────────────────────────────────────────────
// SRP: Backend communication + response parsing for chat operations.
// DIP: Depends on IApiClient, ChatConfig, IFallbackReply, IJsonExtractor (all abstractions).
// OCP: Context enrichment open for extension via ISystemPromptBuilder.

import type { IApiClient } from '@/core/services/api/interfaces/IApiClient';
import type {
  IChatService,
  IFallbackReply,
  IJsonExtractor,
  ISystemPromptBuilder,
} from '@/core/services/interfaces/IChatService';
import type { ChatMessage, ChatRequest, ChatResponse, ChatConfig } from '@/shared/types/chat.types';

export class ChatService implements IChatService {
  constructor(
    private readonly apiClient: IApiClient,
    private readonly config: ChatConfig,
    private readonly fallback: IFallbackReply,
    private readonly jsonExtractor: IJsonExtractor,
    private readonly systemPromptBuilder: ISystemPromptBuilder,
  ) {}

  isAvailable(): boolean {
    return typeof window !== 'undefined';
  }

  async sendMessage(request: ChatRequest): Promise<ChatResponse> {
    try {
      const apiResponse = await this.apiClient.post<{
        reply: string;
        conversationId: string;
        tokens?: { input: number; output: number; total: number };
        model?: string;
        provider?: string;
        liveData?: Record<string, unknown>;
      }>(this.config.apiEndpoint, {
        message: request.message,
        conversationId: request.conversationId ?? undefined,
        context: request.context ?? {},
        systemPrompt: request.systemPrompt ?? this.systemPromptBuilder.build(request.context),
        history: request.history ?? [],
      });

      const response = apiResponse.data!;

      if (!response || !response.reply) {
        throw new Error('Empty reply from chat backend');
      }

      // Backend does NOT return chartType/chartData/suggestions as top-level fields.
      // The LLM embeds chart JSON inside the reply string (per system prompt).
      // Parse it out client-side using the brace-balanced JSON extractor.
      const parsed = this.jsonExtractor.extract(response.reply ?? '');
      const reply = parsed?.cleaned ?? response.reply;

      const chartData = parsed?.chartData as Array<{ label: string; value: number }> | undefined;
      const chartType = parsed?.chartType as 'bar' | undefined;

      // Backend does NOT return suggestions. Infer client-side via fallback.
      const suggestions = this.fallback.generateSuggestions(reply);

      return {
        reply,
        conversationId: response.conversationId ?? '',
        tokens: response.tokens ?? { input: 0, output: 0 },
        model: response.model,
        provider: response.provider,
        liveData: response.liveData,
        chartData,
        chartType,
        suggestions,
      };
    } catch {
      const fb = this.fallback.generate(request.message);
      return {
        reply: fb.reply,
        conversationId: '',
        tokens: { input: 0, output: 0 },
        suggestions: fb.suggestions,
      };
    }
  }

  async getHistory(_limit?: number): Promise<ChatMessage[]> {
    try {
      const apiResponse = await this.apiClient.get<{ messages?: ChatMessage[]; data?: ChatMessage[] }>(
        '/chat/history',
        _limit ? { params: { limit: String(_limit) } } : undefined,
      );
      const data = apiResponse.data;
      if (data?.messages) return data.messages;
      if (data?.data) return data.data;
      return [];
    } catch {
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    try {
      await this.apiClient.delete('/chat/history');
    } catch {
      // ignore
    }
  }

  async getSuggestions(_query: string, _context?: string): Promise<string[]> {
    try {
      const apiResponse = await this.apiClient.post<{ suggestions?: string[] }>('/chat/suggestions', {
        query: _query,
        context: _context,
      });
      return apiResponse.data?.suggestions ?? [];
    } catch {
      return [];
    }
  }
}
