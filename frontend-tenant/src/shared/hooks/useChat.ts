// ─── useChat.ts (Unified) ──────────────────────────────────────────────────────
// SRP: Orchestrates ChatService + ChatStore + UI state for the chat panel.
// DIP: Depends on IChatService + ISlashCommandProvider (abstractions).
// Uses React Zustand selectors (reactive, consistent with all 19 stores).

'use client';

import { useCallback, useRef, useState } from 'react';
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
  const messagesRaw = useChatStore((s) => s.messages);
  const messages = Array.isArray(messagesRaw) ? messagesRaw : [];
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
  const abortRef = useRef<(() => void) | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim() || sending) return;

      setError(null);
      setSending(true);

      if (abortRef.current) {
        abortRef.current();
      }

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

      const context = slashCommands.getContextForTrigger(content.toLowerCase());
      const accumulatedContent: string[] = [];

      const cleanup = chatService.sendMessageStream(
        {
          message: content.trim(),
          conversationId: conversationId ?? undefined,
          context: { pageContext, slashContext: context },
        },
        (text) => {
          accumulatedContent.push(text);
          updateMessage(assistantMsg.id, { content: accumulatedContent.join('') });
        },
        (newConversationId) => {
          const finalContent = accumulatedContent.join('');
          const parsed = extractInlineJson(finalContent);
          updateMessage(assistantMsg.id, {
            content: parsed.cleaned,
            timestamp: new Date().toISOString(),
            metadata: {
              isStreaming: false,
              chart: parsed.chartData
                ? { chartType: 'bar' as const, chartData: parsed.chartData }
                : undefined,
            },
          });
          setConversationId(newConversationId);
        },
        (errorMessage) => {
          removeMessage(assistantMsg.id);
          setError(errorMessage ?? 'Sorry, something went wrong. Please try again.');
        },
        () => {
          setSending(false);
        },
      );

      abortRef.current = cleanup ?? null;
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

/**
 * Extract inline chart JSON from text and return cleaned text + chart data.
 * Mirrors the logic previously in ConversationalAIService._parseMetadata().
 */
function extractInlineJson(
  text: string,
): { cleaned: string; chartData?: Array<{ label: string; value: number }> } {
  const firstBrace = text.indexOf('{');
  if (firstBrace < 0) return { cleaned: text };

  let depth = 0;
  let inString = false;
  let escape = false;
  let start = firstBrace;
  let end = -1;

  for (let i = firstBrace; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === '\\') {
        escape = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }
    if (ch === '"') {
      inString = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === '}') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end < 0) return { cleaned: text };

  const jsonStr = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;
    if (parsed && typeof parsed === 'object' && 'chartType' in parsed) {
      const cleaned = (text.slice(0, start) + text.slice(end + 1)).trim();
      return {
        cleaned,
        chartData: (parsed.chartData as Array<{ label: string; value: number }>) ?? [],
      };
    }
  } catch {
    /* not valid JSON, return original */
  }

  return { cleaned: text };
}

