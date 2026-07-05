'use client';

/**
 * /home — Enhanced 3-column home page with left icon panel, center content, and right widgets
 * 
 * Layout (3-column design):
 *   ┌─ Left Panel ───┬─ Center Content ──────────────┬─ Right Widgets ───┐
 *   │ Glossy Icons   │ Hero (date/greeting/AI)       │ Live Feed         │
 *   │ Dynamic        │ KPI Strip                     │ Stats             │
 *   │ Selectable     │ Network Status                │ Quick Actions     │
 *   │ (Home only)    │ Departments + Quick Actions   │ Tasks             │
 *   │                │ Recent Tasks                  │ Approvals         │
 *   └────────────────┴───────────────────────────────┴───────────────────┘
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Sparkles, Menu } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import { tenantsService, type TenantSelf } from '@/services/tenants.service';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useUIPreferencesStore } from '@/stores/uiPreferencesStore';
import { commandCenterService } from '@/services/command-center.service';
import TenantShell from '@/components/TenantShell';
import { HomeHero } from '@/components/home/HomeHero';
import { HomeKpiStrip } from '@/components/home/HomeKpiStrip';
import { HomeNetworkStatus, type NetworkErrorDescriptor } from '@/components/home/HomeNetworkStatus';
import { LeftPanel } from '@/components/home/LeftPanel';
import { RightPanel } from '@/components/home/RightPanel';
import { GlassPanel } from '@/components/home/GlassPanel';
import {
  AIChatButton,
  AIChatPanel,
} from '@/features/ai-chat/components/AIChatPanel';

export default function HomePage() {
  const user = useTenantAuth();
  const router = useRouter();
  const pathname = usePathname();

  // ── UI State ────────────────────────────────────────────────────────────
  const backgroundStyle = useUIPreferencesStore((s) => s.backgroundStyle);
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);

  // ── Stores ──────────────────────────────────────────────────────────────
  const setAgents = useAgentStore((s) => s.setAgents);
  const agents = useAgentStore((s) => s.agents);
  const tasks = useTaskStore((s) => s.tasks);
  const setTasks = useTaskStore((s) => s.setTasks);
  const departments = useDepartmentStore((s) => s.departments);
  const setDepartments = useDepartmentStore((s) => s.setDepartments);

  // ── Local view state ────────────────────────────────────────────────────
  const [tenant, setTenant] = useState<TenantSelf | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);
  const [errors, setErrors] = useState<NetworkErrorDescriptor[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [monthCost, setMonthCost] = useState<number | null>(null);

  // ── Error handling ──────────────────────────────────────────────────────
  const pushOrReplaceError = useCallback((key: string, message: string | null) => {
    setErrors((prev) => {
      const idx = prev.findIndex((e) => e.key === key);
      if (message === null) {
        if (idx === -1) return prev;
        const copy = prev.slice();
        copy.splice(idx, 1);
        return copy;
      }
      const entry: NetworkErrorDescriptor = { key, message };
      if (idx === -1) return [...prev, entry];
      const copy = prev.slice();
      copy[idx] = entry;
      return copy;
    });
  }, []);

  // ── Fetch tenant ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoadingTenant(true);
    tenantsService
      .getCurrent()
      .then((t) => {
        if (!cancelled) setTenant(t);
        pushOrReplaceError('tenant', null);
      })
      .catch((err: unknown) => {
        const message = err instanceof Error ? err.message : 'Unable to load workspace info';
        pushOrReplaceError('tenant', message);
      })
      .finally(() => {
        if (!cancelled) setLoadingTenant(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, retryCount, pushOrReplaceError]);

  // ── Fetch command-center summary ────────────────────────────────────────
  const fetchSummary = useCallback(async () => {
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
      pushOrReplaceError('summary', null);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Workspace data unavailable';
      pushOrReplaceError('summary', message);
      return false;
    }
  }, [setAgents, setTasks, setDepartments, pushOrReplaceError]);

  useEffect(() => {
    if (!user) return;
    void fetchSummary();
  }, [user, fetchSummary]);

  // ── Derived data ───────────────────────────────────────────────────────
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

  // ── Background styles ───────────────────────────────────────────────────
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

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className={`min-h-screen ${getBackgroundClass()} relative overflow-hidden`}>
        {/* Animated background gradient */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl opacity-20" />
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl opacity-20" />
        </div>

        {/* Main content wrapper */}
        <div className="relative z-10 flex h-screen overflow-hidden">
          {/* Left Panel */}
          <AnimatePresence>
            {leftPanelOpen && (
              <LeftPanel isOpen={true} onClose={() => setLeftPanelOpen(false)} />
            )}
          </AnimatePresence>

          {/* Center + Right Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Mobile menu button */}
            {!leftPanelOpen && pathname === '/home' && (
              <div className="sticky top-0 z-30 px-6 py-4 border-b border-white/10 backdrop-blur-sm bg-slate-950/50 flex items-center gap-4">
                <button
                  onClick={() => setLeftPanelOpen(true)}
                  className="rounded-lg p-2 hover:bg-white/10 transition-colors"
                >
                  <Menu className="w-5 h-5 text-zinc-300" />
                </button>
              </div>
            )}

            {/* Page content */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 h-full">
                {pathname === '/home' ? (
                  // Home page: 2-column layout (main + right panel) - centered hero
                  <div className="flex gap-6 h-full justify-center">
                    {/* Main content column - centered and narrower */}
                    <div className="flex-1 min-w-0 space-y-6 overflow-y-auto pr-2 flex flex-col items-center justify-start max-w-2xl">
                      {/* Hero section - centered and reduced size */}
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5 }}
                        className="w-full max-w-xl"
                      >
                        <GlassPanel className="p-6">
                          <HomeHero tenant={tenant} onSend={handleSend} />
                        </GlassPanel>
                      </motion.div>

                      {/* KPI Strip */}
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.5, delay: 0.1 }}
                        className="w-full max-w-xl"
                      >
                        <HomeKpiStrip monthCost={monthCost} />
                      </motion.div>

                      {/* Network Status */}
                      {errors.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: 0.2 }}
                          className="w-full max-w-xl"
                        >
                          <HomeNetworkStatus errors={errors} onRetry={() => setRetryCount((c) => c + 1)} busy={loadingTenant} />
                        </motion.div>
                      )}
                    </div>

                    {/* Right Panel - Widgets - reduced padding */}
                    <motion.div
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                      className="w-72 flex-shrink-0 overflow-y-auto"
                    >
                      <RightPanel />
                    </motion.div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* AI Chat Components */}
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
