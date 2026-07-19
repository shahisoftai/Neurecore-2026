// ─── chat.factory.ts (Admin) ────────────────────────────────────────────────────
// SRP: Dependency injection wiring for the admin portal's chat system.
// DIP: All services depend on abstractions (IChatService, etc.).
//
// Exports wired singletons consumed by AdminShell and useChat().

import api from '@/services/api';
import { AxiosApiClient } from '@/core/services/api/AxiosApiClient';
import { ChatService } from '@/core/services/chat/ChatService';
import { createChatStore } from '@/core/services/chat/ChatStore';
import { BraceBalancedJsonExtractor } from '@/core/services/chat/fallback/BraceBalancedJsonExtractor';
import { KeywordFallbackReply } from '@/core/services/chat/fallback/KeywordFallbackReply';
import { AdminSystemPromptBuilder } from '@/core/services/chat/fallback/AdminSystemPromptBuilder';
import { AdminSlashCommands } from '@/core/services/chat/slash-commands/AdminSlashCommands';
import type { ChatConfig } from '@/shared/types/chat.types';

// ── Admin Chat Config ──────────────────────────────────────────────────────
const adminChatConfig: ChatConfig = {
  panelTitle: 'NeureCore Admin',
  badgeLabel: 'ADMIN',
  badgeColor: 'violet',
  triggerIcon: '◈',
  placeholder: 'Ask about tenants, billing, agents, or system status… or type / for commands',
  maxMessages: 100,
  storageKey: 'admin_chat_store',
  apiEndpoint: '/chat/messages',
  starterPrompts: [
    'How many tenants are active today?',
    'Which tenants have failing agents?',
    "What's the platform's gross margin this month?",
    'Show me current system error rate',
    'List recent feature flag changes',
  ],
  homeHeroChips: [
    'Platform health summary',
    'Show top tenants by cost',
    'Any active incidents?',
    'List paused agents',
  ],
};

// ── Wired Singletons ────────────────────────────────────────────────────────
const apiClient = new AxiosApiClient(api);
export const jsonExtractor = new BraceBalancedJsonExtractor();

export const chatService = new ChatService(
  apiClient,
  adminChatConfig,
  new KeywordFallbackReply(),
  jsonExtractor,
  new AdminSystemPromptBuilder(),
);

export const useChatStore = createChatStore(adminChatConfig);
export const slashCommands = new AdminSlashCommands();
export { adminChatConfig };
