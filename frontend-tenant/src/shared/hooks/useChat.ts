// ─── useChat.ts (Unified) ──────────────────────────────────────────────────────
// SRP: Orchestrates ChatService + ChatStore + UI state for the chat panel.
// DIP: Depends on IChatService + ISlashCommandProvider (abstractions).
// Uses React Zustand selectors (reactive, consistent with all 19 stores).

'use client';

import { useCallback, useState } from 'react';
import type { IChatService, ISlashCommandProvider } from '@/core/services/interfaces/IChatService';
import type { ChatMessage, ChatConfig } from '@/shared/types/chat.types';
import { useChatStore } from '@/core/services/chat/chat.factory';

let _msgId = 0;
function generateId(): string {
  return `msg_${Date.now()}_${++_msgId}`;
}

export function useChat(
  chatService: IChatService,
  slashCommands: ISlashCommandProvider,
  _config: ChatConfig,
  pageContext?: string,
) {
  const messages = useChatStore((s) => s.messages);
  const open = useChatStore((s) => s.open);
  const sending = useChatStore((s) => s.sending);
  const conversationId = useChatStore((s) => s.conversationId);
  const addMessage = useChatStore((s) => s.addMessage);
  const updateMessage = useChatStore((s) => s.updateMessage);
  const removeMessage = useChatStore((s) => s.removeMessage);
  const clearHistory = useChatStore((s) => s.clearHistory);
  const setConversationId = useChatStore((s) => s.setConversationId);
  const setOpen = useChatStore((s) => s.setOpen);
  const toggleOpen = useChatStore((s) => s.toggleOpen);
  const setSending = useChatStore((s) => s.setSending);

  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || sending) return;

      setError(null);
      setSending(true);

      const userMsg: ChatMessage = {
        id: generateId(),
        role: 'user',
        content: content.trim(),
        timestamp: new Date().toISOString(),
      };
      addMessage(userMsg);

      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: '',
        timestamp: new Date().toISOString(),
        metadata: { isStreaming: true },
      };
      addMessage(assistantMsg);

      try {
        const context = slashCommands.getContextForTrigger(content.toLowerCase());
        const response = await chatService.sendMessage({
          message: content.trim(),
          conversationId: conversationId ?? undefined,
          context: { pageContext, slashContext: context },
        });

        updateMessage(assistantMsg.id, {
          content: response.reply,
          timestamp: new Date().toISOString(),
          tokens: response.tokens
            ? { input: response.tokens.input, output: response.tokens.output }
            : undefined,
          metadata: {
            isStreaming: false,
            chart: response.chartData
              ? { chartType: 'bar' as const, chartData: response.chartData }
              : undefined,
            suggestions: response.suggestions?.map((s) => ({ label: s })),
          },
        });
        setConversationId(response.conversationId);
      } catch {
        removeMessage(assistantMsg.id);
        setError('Sorry, something went wrong. Please try again.');
      } finally {
        setSending(false);
      }
    },
    [
      chatService,
      slashCommands,
      pageContext,
      sending,
      conversationId,
      addMessage,
      updateMessage,
      removeMessage,
      setConversationId,
      setSending,
    ],
  );

  return {
    messages,
    open,
    sending,
    error,
    sendMessage,
    clearHistory,
    setOpen,
    toggleOpen,
    setError,
  };
}
