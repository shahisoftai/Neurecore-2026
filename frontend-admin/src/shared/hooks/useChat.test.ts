// ─── useChat.test.ts ────────────────────────────────────────────────────────────
// Regression test for the external-message consumption bug (admin copy).
// Mirrors frontend-tenant/src/shared/hooks/useChat.test.ts.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// Mock the axios api module to avoid pulling in AuthProvider JSX transitively.
vi.mock('@/services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

import { useChat } from '@/shared/hooks/useChat';
import type {
  IChatService,
  ISlashCommandProvider,
  IJsonExtractor,
} from '@/core/services/interfaces/IChatService';
import type { ChatConfig } from '@/shared/types/chat.types';
import { useChatStore } from '@/core/services/chat/chat.factory';

const mockSlashCommands: ISlashCommandProvider = {
  commands: [],
  getContextForTrigger: () => undefined,
  getSuggestions: () => [],
};

const mockJsonExtractor: IJsonExtractor = {
  extract: (raw: string) => ({ cleaned: raw }),
};

function makeChatService(): IChatService {
  return {
    isAvailable: () => true,
    sendMessage: vi.fn(),
    sendMessageStream: vi.fn(() => () => {}),
    getHistory: vi.fn(async () => []),
    clearHistory: vi.fn(async () => undefined),
    getSuggestions: vi.fn(async () => []),
  };
}

const dummyConfig: ChatConfig = {
  panelTitle: 'Test',
  badgeLabel: 'ADMIN',
  badgeColor: 'violet',
  triggerIcon: '◈',
  placeholder: 'Ask…',
  maxMessages: 100,
  storageKey: 'useChat_test_store_admin',
  apiEndpoint: '/chat/messages',
  starterPrompts: [],
  homeHeroChips: [],
};

describe('useChat — external message consumption (admin)', () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.setState({
      messages: [],
      open: false,
      sending: false,
      conversationId: null,
      pendingExternalMessage: null,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('consumes pendingExternalMessage when requestExternalSend fires after mount', async () => {
    const chatService = makeChatService();

    const { rerender } = renderHook(() =>
      useChat(chatService, mockSlashCommands, mockJsonExtractor, dummyConfig),
    );

    await act(async () => {
      await Promise.resolve();
    });

    await act(async () => {
      useChatStore.getState().requestExternalSend('admin hello');
      rerender();
    });

    expect(chatService.sendMessageStream).toHaveBeenCalled();
    const callArgs = (chatService.sendMessageStream as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(callArgs[0].message).toBe('admin hello');
    expect(useChatStore.getState().pendingExternalMessage).toBeNull();
  });

  it('does nothing when no external request is pending', async () => {
    const chatService = makeChatService();

    renderHook(() =>
      useChat(chatService, mockSlashCommands, mockJsonExtractor, dummyConfig),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(chatService.sendMessageStream).not.toHaveBeenCalled();
  });
});
