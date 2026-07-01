// ─── Chat Service (Tenant Portal) ────────────────────────────────────────────
// D — Dependency Inversion: all chat API calls abstracted here
// S — Single Responsibility: conversational control API only

import api from './api';
import type {
  ChatRequest,
  ChatResponse,
  ConversationMessage,
} from '@/types/chat.types';

// Canned suggestions per slash command (shown in InputBox)
export const SLASH_COMMANDS = [
  { trigger: '/agents', label: 'Agent queries', context: 'agent' as const, suggestions: ['How many agents are running?', 'Which agents have high workload?', 'Show me failed agents', 'Pause all idle agents'] },
  { trigger: '/tasks', label: 'Task queries', context: 'task' as const, suggestions: ['How many tasks completed today?', 'Which tasks failed this week?', 'Assign a new task', 'Show pending tasks'] },
  { trigger: '/costs', label: 'Cost & budget', context: 'system' as const, suggestions: ['What is my cost today?', 'Which agent costs the most?', 'Show cost breakdown', 'Reduce expenses by 10%'] },
  { trigger: '/workflows', label: 'Workflow queries', context: 'workflow' as const, suggestions: ['List active workflows', 'Which workflows failed?', 'Show workflow execution history'] },
  { trigger: '/approvals', label: 'Pending approvals', context: 'system' as const, suggestions: ['What is pending approval?', 'Show urgent approvals'] },
];

function makeId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// I — Interface Segregation: only the methods relevant to chat
interface IChatService {
  sendMessage(req: ChatRequest): Promise<ChatResponse>;
  getHistory(limit?: number): Promise<ConversationMessage[]>;
  clearHistory(): Promise<void>;
  getSuggestions(query: string): Promise<string[]>;
}

const chatService: IChatService = {
  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    try {
      const res = await api.post<{ data: ChatResponse }>('/chat/messages', req);
      const backendData = (res as any).data?.data;
      // Backend /api/v1/chat/messages returns
      //   { status, data: { reply, conversationId, tokens, model, provider }, meta }
      if (backendData && typeof backendData.reply === 'string') {
        return {
          id: makeId(),
          type: 'assistant',
          message: backendData.reply,
          conversationId: backendData.conversationId,
          tokens: backendData.tokens,
          model: backendData.model,
          provider: backendData.provider,
          timestamp: new Date().toISOString(),
        };
      }
      return fallbackResponse(req.query);
    } catch {
      return fallbackResponse(req.query);
    }
  },

  async getHistory(limit = 50): Promise<ConversationMessage[]> {
    try {
      const res = await api.get<{ data: { data: ConversationMessage[] } }>(
        `/chat/history?limit=${limit}`,
      );
      return (res as any).data?.data?.data ?? [];
    } catch {
      return [];
    }
  },

  async clearHistory(): Promise<void> {
    try {
      await api.delete('/chat/history');
    } catch { /* no-op */ }
  },

  async getSuggestions(query: string): Promise<string[]> {
    // First check slash commands for instant offline suggestions
    const slash = SLASH_COMMANDS.find((s) => query.startsWith(s.trigger));
    if (slash) return slash.suggestions;

    try {
      const res = await api.post<{ data: { suggestions: string[] } }>(
        '/chat/suggestions',
        { query },
      );
      return (res as any).data?.data?.suggestions ?? [];
    } catch {
      return [];
    }
  },
};

/** Graceful degradation only used when the backend returns nothing usable */
function fallbackResponse(query: string): ChatResponse {
  return {
    id: makeId(),
    type: 'info',
    message: `I received your query: *"${query}"*. The chat backend is reachable but returned an empty response. The MiniMax assistant should reply here — please retry.`,
    tokens: { input: 0, output: 0 },
    timestamp: new Date().toISOString(),
  };
}

export default chatService;
