'use client';

/**
 * /home — Creatio-style home with hero + KPIs + right rail.
 *
 * Navigation is provided by the IconRail (rendered by TenantShell). The
 * /home page only renders the centre content + right widgets.
 *
 * Layout:
 *   ┌─ IconRail (in TenantShell) ─┬─ Centre ────────────────────┬─ Right rail ──┐
 *   │                             │  Hero (date/greeting/AI)    │  Live Feed    │
 *   │                             │  KPI Strip                  │  Stats        │
 *   │                             │  Network Status (errors)    │  Quick Actions│
 *   │                             │                             │  Tasks        │
 *   │                             │                             │  Approvals    │
 *   └─────────────────────────────┴─────────────────────────────┴───────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { useAuthStore } from '@/stores/authStore';
import { useApprovals } from '@/hooks/useApprovals';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { commandCenterService } from '@/services/command-center.service';
import TenantShell from '@/components/TenantShell';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeKpiStrip } from '@/components/home/HomeKpiStrip';
import { HomeNetworkStatus } from '@/components/home/HomeNetworkStatus';
import { RightPanel } from '@/components/home/RightPanel';
import { GlassPanel } from '@/components/home/GlassPanel';
import {
  AIChatButton,
  AIChatPanel,
} from '@/features/ai-chat/components/AIChatPanel';

export default function HomePage() {
  const user = useTenantAuth();
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  const backgroundStyle = useUIPreferencesStore((s) => s.backgroundStyle);

  const setAgents = useAgentStore((s) => s.setAgents);
  const agents = useAgentStore((s) => s.agents);
  const tasks = useTaskStore((s) => s.tasks);
  const setTasks = useTaskStore((s) => s.setTasks);
  const departments = useDepartmentStore((s) => s.departments);
  const setDepartments = useDepartmentStore((s) => s.setDepartments);

  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [monthCost, setMonthCost] = useState<number | null>(null);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const { critical, routine } = useApprovals({ autoRefresh: true, refreshInterval: 120_000 });
  const pendingApprovals = useMemo(
    () => (Array.isArray(critical) ? critical : []).length + (Array.isArray(routine) ? routine : []).length,
    [critical, routine],
  );

  const fetchSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const summary = await commandCenterService.getSummary();
      const allAgents = (summary as { agents?: { list: unknown[] } }).agents?.list ?? [];
      setAgents(allAgents as never[]);
      const allTasks = (summary as { tasks?: { list: unknown[] } }).tasks?.list ?? [];
      setTasks(allTasks as never[]);
      const allDepts = (summary as { departments?: { list: unknown[] } }).departments?.list ?? [];
      setDepartments(allDepts as never[]);
      const monthCents = (summary as { costs?: { monthCents: number } }).costs?.monthCents;
      if (typeof monthCents === 'number') setMonthCost(monthCents / 100);
      setSummaryError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Workspace data unavailable';
      setSummaryError(message);
    } finally {
      setSummaryLoading(false);
    }
  }, [setAgents, setTasks, setDepartments]);

  useEffect(() => {
    if (!user) return;
    void fetchSummary();
  }, [user, fetchSummary]);

  const safeDepartments = useMemo(() => (Array.isArray(departments) ? departments : []), [departments]);
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

  const agentCountByDept = useMemo(() => {
    const m = new Map<string, number>();
    if (!Array.isArray(agents)) return m;
    for (const a of agents) {
      const id = (a as { departmentId?: string }).departmentId;
      if (id) m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  }, [agents]);

  const getBackgroundClass = () => {
    switch (backgroundStyle) {
      case 'gradient-blue':
        return 'bg-gradient-to-br from-blue-950 via-slate-900 to-slate-950';
      case 'gradient-purple':
        return 'bg-gradient-to-br from-purple-950 via-slate-900 to-slate-950';
      case 'gradient-dark':
        return 'bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950';
      case 'solid-dark':
        return 'bg-slate-950';
      default:
        return 'bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950';
    }
  };

  const handleSend = (message: string) => {
    setPendingMessage(message);
    setAiChatOpen(true);
  };

  if (!hasHydrated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-zinc-500">Loading workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <TenantShell user={user}>
      <div className={`min-h-screen ${getBackgroundClass()} relative overflow-hidden`}>
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl opacity-20" />
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 py-6 space-y-6">
          <GlassPanel className="p-6 max-w-2xl mx-auto">
            <HomeHero tenant={null} onSend={handleSend} />
          </GlassPanel>

          <div className="max-w-2xl mx-auto">
            <HomeKpiStrip
              monthCost={monthCost}
              pendingApprovals={pendingApprovals}
              loading={summaryLoading}
            />
          </div>

          {summaryError && (
            <div className="max-w-2xl mx-auto">
              <HomeNetworkStatus
                errors={[{ key: 'summary', message: summaryError }]}
                onRetry={() => void fetchSummary()}
                busy={summaryLoading}
              />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RightPanel />
          </div>
        </div>

        <AIChatButton onClick={() => setAiChatOpen(true)} />
        <AIChatPanel
          isOpen={aiChatOpen}
          onClose={() => setAiChatOpen(false)}
          initialMessage={pendingMessage ?? undefined}
        />
      </div>
    </TenantShell>
  );
}