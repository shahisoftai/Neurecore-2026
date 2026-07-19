// ─── ChatStore.ts ───────────────────────────────────────────────────────────────
// SRP: Chat message history + panel state using React Zustand with persist.
// Consistent with all 19 existing stores in the codebase (create + persist).

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ChatMessage, ChatConfig } from '@/shared/types/chat.types';

interface ChatStoreState {
  open: boolean;
  messages: ChatMessage[];
  conversationId: string | null;
  sending: boolean;
  pendingExternalMessage: string | null;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  addMessage: (msg: ChatMessage) => void;
  updateMessage: (id: string, updates: Partial<ChatMessage>) => void;
  removeMessage: (id: string) => void;
  clearHistory: () => void;
  setConversationId: (id: string) => void;
  setSending: (sending: boolean) => void;
  requestExternalSend: (message: string) => void;
  consumeExternalMessage: () => string | null;
}

type ChatStoreFactory = ReturnType<typeof createChatStore>;

export function createChatStore(config: ChatConfig) {
  return create<ChatStoreState>()(
    persist(
      (set, get) => ({
        open: false,
        messages: [],
        conversationId: null,
        sending: false,
        pendingExternalMessage: null,

        setOpen: (open) => set({ open }),
        toggleOpen: () => set((s) => ({ open: !s.open })),

        addMessage: (msg) =>
          set((s) => ({
            messages: [...s.messages.slice(-(config.maxMessages - 1)), msg],
          })),

        updateMessage: (id, updates) =>
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === id ? { ...m, ...updates } : m,
            ),
          })),

        removeMessage: (id) =>
          set((s) => ({
            messages: s.messages.filter((m) => m.id !== id),
          })),

        clearHistory: () => set({ messages: [], conversationId: null }),
        setConversationId: (conversationId) => set({ conversationId }),
        setSending: (sending) => set({ sending }),
        requestExternalSend: (message) =>
          set({ pendingExternalMessage: message, open: true }),
        consumeExternalMessage: () => {
          const pending = get().pendingExternalMessage;
          if (typeof pending !== 'string') return null;
          set({ pendingExternalMessage: null });
          return pending;
        },
      }),
      {
        name: config.storageKey,
        partialize: (state) => ({
          messages: Array.isArray(state.messages)
            ? state.messages.slice(-config.maxMessages)
            : [],
          conversationId: state.conversationId,
        }),
        merge: (persistedState, currentState) => {
          const ps = (persistedState ?? {}) as Partial<ChatStoreState>;
          return {
            ...currentState,
            ...ps,
            messages: Array.isArray(ps.messages) ? ps.messages : currentState.messages,
            conversationId:
              typeof ps.conversationId === 'string' || ps.conversationId === null
                ? ps.conversationId
                : currentState.conversationId,
            sending: typeof ps.sending === 'boolean' ? ps.sending : currentState.sending,
            open: typeof ps.open === 'boolean' ? ps.open : currentState.open,
            pendingExternalMessage: null,
          };
        },
      },
    ),
  );
}

export type { ChatStoreFactory };
