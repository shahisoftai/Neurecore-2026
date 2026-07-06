// ─── TenantSystemPromptBuilder.ts ────────────────────────────────────────────────
// SRP: Builds the system prompt sent to the LLM via the chat endpoint.

import type { ISystemPromptBuilder } from '@/core/services/interfaces/IChatService';

const SYSTEM_PROMPT = `You are HeadQuarter's AI assistant — a concise, data-driven advisor for an AI-employee business platform.
Answer questions about company operations, agent performance, workflows, and tasks.
Keep answers brief (2–4 sentences). When data is available, provide actionable insights.
For visualisable data, include a JSON block (no markdown) with keys: chartType, chartData [{label, value}].`;

export class TenantSystemPromptBuilder implements ISystemPromptBuilder {
  build(_context?: Record<string, unknown>): string {
    return SYSTEM_PROMPT;
  }
}
