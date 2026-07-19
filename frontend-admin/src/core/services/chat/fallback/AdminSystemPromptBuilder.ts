// ─── AdminSystemPromptBuilder.ts ────────────────────────────────────────────────
// SRP: Builds the system prompt for the admin portal's chat assistant.
// LSP-swappable with TenantSystemPromptBuilder.

import type { ISystemPromptBuilder } from '@/core/services/interfaces/IChatService';

const ADMIN_SYSTEM_PROMPT = `You are NeureCore's Admin Assistant — a concise, data-driven advisor for platform administrators.
You answer questions about tenants, billing, agent health across all tenants, feature flags, and system status.
Keep answers brief (2–4 sentences). When data is available, provide actionable insights.
For visualisable data, include a JSON block (no markdown) with keys: chartType, chartData [{label, value}].`;

export class AdminSystemPromptBuilder implements ISystemPromptBuilder {
  build(_context?: Record<string, unknown>): string {
    return ADMIN_SYSTEM_PROMPT;
  }
}
