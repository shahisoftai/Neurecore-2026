// ─── Chat Service (Admin Portal) ─────────────────────────────────────────────
// D — Dependency Inversion + S — Single Responsibility
// Admin version: extended context options (tenant, billing) and strategy forecast

import api from './api';
import { unwrapArrayOrEmpty, unwrapItem } from './unwrap';
import type {
  ChatRequest,
  ChatResponse,
  ConversationMessage,
} from '@/types/chat.types';
import type {
  ScenarioParameters,
  ForecastResult,
  ForecastPoint,
} from '@/types/strategy.types';

export const SLASH_COMMANDS = [
  { trigger: '/agents', label: 'Agent queries', context: 'agent' as const, suggestions: ['How many agents are running platform-wide?', 'Which tenants have failing agents?', 'Show agent error rate'] },
  { trigger: '/tenants', label: 'Tenant queries', context: 'tenant' as const, suggestions: ['Which tenants are most active?', 'Show tenants with anomalies', 'List inactive tenants', 'Which tenant costs the most?'] },
  { trigger: '/billing', label: 'Billing queries', context: 'billing' as const, suggestions: ['Platform revenue today', 'Show cost by tenant', 'Which tenants are unpaid?', 'Show gross margin'] },
  { trigger: '/system', label: 'System status', context: 'system' as const, suggestions: ['What is the current error rate?', 'Show service health', 'Any active incidents?'] },
];

function makeId() {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

interface IAdminChatService {
  sendMessage(req: ChatRequest): Promise<ChatResponse>;
  getHistory(limit?: number): Promise<ConversationMessage[]>;
  clearHistory(): Promise<void>;
  getSuggestions(query: string): Promise<string[]>;
}

const chatService: IAdminChatService = {
  async sendMessage(req: ChatRequest): Promise<ChatResponse> {
    try {
      const res = await api.post<{ data: ChatResponse }>('/chat/messages', req);
      return (unwrapItem(res) as ChatResponse) ?? fallbackResponse(req.query);
    } catch {
      return fallbackResponse(req.query);
    }
  },

  async getHistory(limit = 50): Promise<ConversationMessage[]> {
    try {
      const res = await api.get<{ data: { data: ConversationMessage[] } }>(
        `/chat/history?limit=${limit}`,
      );
      return unwrapArrayOrEmpty(res) as ConversationMessage[];
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
    const slash = SLASH_COMMANDS.find((s) => query.startsWith(s.trigger));
    if (slash) return slash.suggestions;
    try {
      const res = await api.post<{ data: { suggestions: string[] } }>(
        '/chat/suggestions', { query },
      );
      return (res as any).data?.data?.suggestions ?? [];
    } catch {
      return [];
    }
  },
};

// ─── Strategy Service ─────────────────────────────────────────────────────────
// S — Single Responsibility: scenario forecasting API only
export const strategyService = {
  async forecast(params: ScenarioParameters): Promise<ForecastResult> {
    try {
      const res = await api.post<{ data: ForecastResult }>('/strategy/forecast', { parameters: params });
      return (res as any).data?.data ?? buildLocalForecast(params);
    } catch {
      return buildLocalForecast(params);
    }
  },

  async saveScenario(
    name: string,
    description: string,
    params: ScenarioParameters,
  ): Promise<{ id: string; name: string; createdAt: string }> {
    try {
      const res = await api.post<{ data: { id: string; name: string; createdAt: string } }>('/strategy/scenarios', {
        name, description, parameters: params,
      });
      return (res as any).data?.data;
    } catch {
      return { id: makeId(), name, createdAt: new Date().toISOString() };
    }
  },

  async listScenarios(): Promise<Array<{ id: string; name: string; createdAt: string }>> {
    try {
      const res = await api.get<{ data: { data: unknown[] } }>('/strategy/scenarios');
      return unwrapArrayOrEmpty(res) as Array<{ id: string; name: string; createdAt: string }>;
    } catch { return []; }
  },

  async deleteScenario(id: string): Promise<void> {
    try { await api.delete(`/strategy/scenarios/${id}`); } catch { /* no-op */ }
  },
};

/** Local forecast fallback when backend strategy endpoint is not deployed */
function buildLocalForecast(params: ScenarioParameters): ForecastResult {
  const months        = params.forecastMonths;
  const baseTenants   = 20;
  const baseRevPerTenant = 299;
  const baseCostPerAgent = 45;
  const baseAgents    = baseTenants * 3;
  const growthRate    = params.tenantGrowth / 100;       // e.g. 10 → 0.10
  const savingsFactor = 1 + params.automationSavings / 100;

  const points: ForecastPoint[] = Array.from({ length: months }, (_, i) => {
    const m = i + 1;
    const label = new Date(Date.now() + m * 30 * 86400000)
      .toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const tenants = Math.round(baseTenants * (1 + growthRate) ** m);
    const agents  = Math.round(baseAgents  * params.tokenMultiplier);
    const revenue = Math.round(tenants * baseRevPerTenant * (1 + params.modelAdoptionRate / 200));
    const cost    = Math.round(agents  * baseCostPerAgent * params.tokenMultiplier * savingsFactor);
    const margin  = revenue - cost;
    const marginPct = revenue > 0 ? parseFloat(((margin / revenue) * 100).toFixed(1)) : 0;
    return { month: label, revenue, cost, margin, marginPct };
  });

  const totalRevenue     = points.reduce((s, p) => s + p.revenue, 0);
  const totalCost        = points.reduce((s, p) => s + p.cost,    0);
  const avgMarginPct     = points.length
    ? parseFloat((points.reduce((s, p) => s + p.marginPct, 0) / points.length).toFixed(1))
    : 0;
  const peakPoint        = points.reduce((best, p) => p.revenue > best.revenue ? p : best, points[0]);
  const breakEvenPoint   = points.find((p) => p.margin >= 0) ?? null;

  return {
    points,
    summary: {
      totalRevenue,
      totalCost,
      avgMarginPct,
      peakMonth:      peakPoint?.month        ?? '',
      breakEvenMonth: breakEvenPoint?.month   ?? null,
    },
  };
}

function fallbackResponse(query: string): ChatResponse {
  return {
    id: makeId(),
    type: 'info',
    message: `Received: *"${query}"*\n\nChat backend (\`/api/chat\`) is not yet deployed. Once live, admin queries will fetch real-time platform data.`,
    tokens: { input: 0, output: 0 },
    timestamp: new Date().toISOString(),
  };
}

export default chatService;
