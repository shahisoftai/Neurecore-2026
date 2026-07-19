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

  /**
   * Stream chat response tokens via SSE.
   * Returns a cleanup function that aborts the request.
   *
   * Events from /chat/stream:
   *   event: delta  data: {"text":"..."}
   *   event: done   data: {"conversationId":"...","tokens":{...}}
   *   event: error  data: {"message":"..."}
   */
  sendMessageStream(
    request: ChatRequest,
    onDelta: (text: string) => void,
    onDone: (conversationId: string) => void,
    onError: (error: string) => void,
    onFinish: () => void,
  ): () => void {
    const baseUrl = (typeof window !== 'undefined' && (window as unknown as { env?: { NEXT_PUBLIC_API_URL?: string } }).env?.NEXT_PUBLIC_API_URL)
      ?? process.env.NEXT_PUBLIC_API_URL
      ?? '/api/v1';
    const endpoint = `${baseUrl}/chat/stream`;

    const controller = new AbortController();

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: request.message,
        conversationId: request.conversationId ?? undefined,
        context: request.context ?? {},
        systemPrompt: request.systemPrompt ?? this.systemPromptBuilder.build(request.context),
        history: request.history ?? [],
      }),
      credentials: 'include',
      signal: controller.signal,
    }).then(async (res) => {
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        onFinish();
      };

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        onError(`HTTP ${res.status}: ${text}`);
        finish();
        return;
      }
      if (!res.body) {
        onError('Empty response body');
        finish();
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEventType = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() ?? '';
          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEventType = line.slice(7).trim();
              continue;
            }
            if (line.startsWith('data: ')) {
              const rawData = line.slice(6).trim();
              const eventType = currentEventType;
              currentEventType = '';
              if (!rawData) continue;
              try {
                const data = JSON.parse(rawData) as Record<string, unknown>;
                if (eventType === 'delta' && 'text' in data && typeof data.text === 'string') {
                  onDelta(data.text);
                } else if (eventType === 'done' && 'conversationId' in data) {
                  onDone(String(data.conversationId));
                  finish();
                } else if (eventType === 'error' && 'message' in data && typeof data.message === 'string') {
                  onError(data.message);
                  finish();
                }
              } catch {
                /* ignore malformed JSON */
              }
            }
          }
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          onError((err as Error).message);
        }
        finish();
      }
      finish();
    }).catch((err) => {
      if ((err as Error).name !== 'AbortError') {
        onError((err as Error).message);
      }
      onFinish();
    });

    return () => controller.abort();
  }
}
