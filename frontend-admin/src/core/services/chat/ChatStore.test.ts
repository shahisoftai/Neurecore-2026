// ─── ChatStore.test.ts ──────────────────────────────────────────────────────────
// Verifies chat store behavior: message cap, persistence partialize, external-trigger.

import { beforeEach, describe, expect, it } from 'vitest';
import { createChatStore } from '@/core/services/chat/ChatStore';
import type { ChatConfig, ChatMessage } from '@/shared/types/chat.types';

const testConfig: ChatConfig = {
  panelTitle: 'Test',
  badgeLabel: 'AI',
  badgeColor: 'indigo',
  triggerIcon: '✦',
  placeholder: 'Ask…',
  maxMessages: 3,
  storageKey: 'test_chat_store',
  apiEndpoint: '/chat/messages',
  starterPrompts: [],
  homeHeroChips: [],
};

const sampleMsg = (id: string, content: string): ChatMessage => ({
  id,
  role: 'user',
  content,
  timestamp: '2026-07-19T00:00:00.000Z',
});

describe('createChatStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('starts empty and closed', () => {
    const useStore = createChatStore(testConfig);
    const { messages, open } = useStore.getState();
    expect(messages).toEqual([]);
    expect(open).toBe(false);
  });

  it('caps messages at maxMessages (FIFO eviction)', () => {
    const useStore = createChatStore(testConfig);
    useStore.getState().addMessage(sampleMsg('a', '1'));
    useStore.getState().addMessage(sampleMsg('b', '2'));
    useStore.getState().addMessage(sampleMsg('c', '3'));
    useStore.getState().addMessage(sampleMsg('d', '4'));
    const ids = useStore.getState().messages.map((m) => m.id);
    expect(ids).toEqual(['b', 'c', 'd']);
  });

  it('updateMessage patches only matching message', () => {
    const useStore = createChatStore(testConfig);
    useStore.getState().addMessage(sampleMsg('a', 'one'));
    useStore.getState().addMessage(sampleMsg('b', 'two'));
    useStore.getState().updateMessage('a', { content: 'ONE' });
    const [first, second] = useStore.getState().messages;
    expect(first.content).toBe('ONE');
    expect(second.content).toBe('two');
  });

  it('removeMessage drops by id', () => {
    const useStore = createChatStore(testConfig);
    useStore.getState().addMessage(sampleMsg('a', 'one'));
    useStore.getState().addMessage(sampleMsg('b', 'two'));
    useStore.getState().removeMessage('a');
    expect(useStore.getState().messages.map((m) => m.id)).toEqual(['b']);
  });

  it('clearHistory empties messages and conversationId', () => {
    const useStore = createChatStore(testConfig);
    useStore.getState().addMessage(sampleMsg('a', 'x'));
    useStore.getState().setConversationId('conv-1');
    useStore.getState().clearHistory();
    expect(useStore.getState().messages).toEqual([]);
    expect(useStore.getState().conversationId).toBeNull();
  });

  it('requestExternalSend opens panel and stages message', () => {
    const useStore = createChatStore(testConfig);
    useStore.getState().requestExternalSend('hello from hero');
    const { open, pendingExternalMessage } = useStore.getState();
    expect(open).toBe(true);
    expect(pendingExternalMessage).toBe('hello from hero');
  });

  it('consumeExternalMessage returns staged message and clears it', () => {
    const useStore = createChatStore(testConfig);
    useStore.getState().requestExternalSend('one-shot');
    const consumed = useStore.getState().consumeExternalMessage();
    expect(consumed).toBe('one-shot');
    expect(useStore.getState().pendingExternalMessage).toBeNull();
  });

  it('consumeExternalMessage returns null when nothing pending', () => {
    const useStore = createChatStore(testConfig);
    expect(useStore.getState().consumeExternalMessage()).toBeNull();
  });

  it('toggleOpen flips open state', () => {
    const useStore = createChatStore(testConfig);
    expect(useStore.getState().open).toBe(false);
    useStore.getState().toggleOpen();
    expect(useStore.getState().open).toBe(true);
    useStore.getState().toggleOpen();
    expect(useStore.getState().open).toBe(false);
  });
});
