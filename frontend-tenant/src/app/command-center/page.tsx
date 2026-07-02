'use client';

/**
 * /command-center — CEO Command Center (Phase 4)
 *
 * Creatio-style landing page replacing the old /dashboard.
 *
 * Layout (Creatio reference image `Home_screenx.png`):
 *   ┌─────────────────────────────────────────────────────────┐
 *   │  HERO: full-bleed background                             │
 *   │    "Friday, 09:40 PM / Hello, Audrey!"                  │
 *   │    [message input → ask CEO agent]                      │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  KPI STRIP: 4 KpiCards                                   │
 *   │    Active agents · Tasks today · Cost MTD · Approvals    │
 *   ├──────────────────────────────────┬──────────────────────┤
 *   │  DEPARTMENT CARDS GRID           │  ACTIVITY TIMELINE  │
 *   │  (creatable, clickable)         │  (live events)       │
 *   ├──────────────────────────────────┴──────────────────────┤
 *   │  CHARTS ROW: Task volume · Task status donut            │
 *   ├─────────────────────────────────────────────────────────┤
 *   │  QUICK ACTIONS: 6-8 large icons (Creatio home style)    │
 *   └─────────────────────────────────────────────────────────┘
 *
 * Feature-flag controlled: ships behind NEXT_PUBLIC_REDESIGN_COMMAND_CENTER.
 * Until the flag is enabled, the /dashboard page serves tenants (via next.config.js rewrite).
 */

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  Wallet,
  AlertCircle,
  TrendingUp,
  Sparkles,
  Store,
  BarChart3,
  ListTodo,
  Building2,
  Headphones,
  Briefcase,
  Target,
  Send,
  RefreshCw,
  Users2,
  Wallet2,
} from 'lucide-react';

import { useTenantAuth } from '@/hooks/useTenantAuth';
import { useTimeline } from '@/hooks/useTimeline';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { QuickAction } from '@/components/creatio/QuickAction';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { AgentCard } from '@/components/agent-card/AgentCard';
import { AreaChart } from '@/components/charts/AreaChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { ImpactTimeline, TimelineFilter } from '@/components/timeline';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useInspectorStore } from '@/stores/inspectorStore';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { useChartData } from '@/hooks/useChartData';
import { useTimeRange } from '@/hooks/useTimeRange';
import { connectSocket, getSocket } from '@/services/socket';
import { commandCenterService } from '@/services/command-center.service';
import { unwrapArrayOrEmpty, unwrapList, unwrapItem } from '@/services/unwrap';
import {
  DailyBriefingButton,
  DailyBriefingModal,
} from '@/features/dashboard/components/DailyBriefing';
import {
  AIChatButton,
  AIChatPanel,
} from '@/features/ai-chat/components/AIChatPanel';

// ─── Types ────────────────────────────────────────────────────────────────
interface ExecutionLog {
  id: string;
  agentId: string;
  taskId?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
  evaluationScore?: number;
  agent?: { name: string };
}

interface DonutSlice {
  name: string;
  value: number;
  color: string;
}

const STATUS_LOG_COLOR: Record<string, string> = {
  RUNNING: 'text-status-ops',
  COMPLETED: 'text-status-profit',
  FAILED: 'text-status-risk',
  CANCELLED: 'text-status-neutral',
};

const RANGE_OPTIONS = [
  { label: '24 h', value: '24h' as const },
  { label: '7 d', value: '7d' as const },
  { label: '30 d', value: '30d' as const },
];

const DEPT_ACCENT_BY_INDEX = ['accent', 'success', 'warning', 'info', 'strategy'] as const;

// ─── Page ─────────────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const user = useTenantAuth();
  const router = useRouter();
  const openInspector = useInspectorStore((s) => s.openInspector);

  const { agents, fetchAgents, setAgents, updateAgentStatus } = useAgentStore();
  const { tasks, fetchTasks, setTasks, updateTaskStatus } = useTaskStore();
  const { workflows, fetchWorkflows, setWorkflows } = useWorkflowStore();
  const { departments, fetchDepartments, setDepartments } = useDepartmentStore();

  const { kpis, loading: kpisLoading } = useDashboardKpis();
  const { range, setRange } = useTimeRange();
  const { data: taskTimeSeries, loading: chartLoading } = useChartData('tasks', range);

  const [logs, setLogs] = useState<ExecutionLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(true);
  const [briefingOpen, setBriefingOpen] = useState(false);
  const [aiChatOpen, setAiChatOpen] = useState(false);
  const [messageInput, setMessageInput] = useState('');
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [monthCost, setMonthCost] = useState<number | null>(null);
  const [agentInboxCount, setAgentInboxCount] = useState<number | null>(null);
  const [showTimeline, setShowTimeline] = useState(true); // Toggle between grid and timeline view

  // Timeline data (Phase 2: Impact Timeline)
  const {
    events: timelineEvents,
    isLoading: timelineLoading,
    filter: timelineFilter,
    setFilter: setTimelineFilter,
    sortBy: timelineSort,
    setSortBy: setTimelineSort,
    searchTerm: timelineSearch,
    setSearchTerm: setTimelineSearch,
    eventCounts: timelineEventCounts,
    summary: timelineSummary,
  } = useTimeline({
    initialFilter: 'urgent',
    initialSort: 'impact',
    autoRefresh: true,
    refreshInterval: 30000,
  });

  // ── Data fetchers ────────────────────────────────────────────────────
  // Performance fix: a single /command-center/summary call replaces the
  // 7 parallel fetches the dashboard used to fire on mount. The response
  // hydrates the same stores the page already reads from.
  const fetchCommandCenterSummary = useCallback(async () => {
    setLogsLoading(true);
    try {
      const summary = await commandCenterService.getSummary();

      // Hydrate the existing stores so the rest of the page is unchanged.
      setAgents(summary.agents.list as never[]);
      setTasks(
        summary.tasks.list.map((t) => ({
          ...t,
          tenantId: '',
          createdAt: t.createdAt,
        })) as never[],
        summary.tasks.total,
      );
      setWorkflows(
        summary.workflows.list.map((w) => ({
          id: w.id,
          name: w.name,
          status: w.isActive ? 'ACTIVE' : 'INACTIVE',
          isActive: w.isActive,
          createdAt: w.createdAt,
          tenantId: '',
        })) as never[],
        summary.workflows.total,
      );
      setDepartments(
        summary.departments.list.map((d) => ({
          id: d.id,
          name: d.name,
          status: d.status,
          tenantId: '',
        })) as never[],
        summary.departments.total,
      );

      setPendingApprovals(summary.approvals.pending);
      setMonthCost(summary.costs.monthCents / 100);
      setLogs(
        summary.activity.map((a) => ({
          id: a.id,
          agentId: '',
          status: a.severity === 'error' ? 'FAILED' : 'COMPLETED',
          startedAt: a.timestamp,
          evaluationScore: undefined,
          agent: { name: a.message },
        })) as ExecutionLog[],
      );
    } catch {
      // Silent fail — keep the existing store contents.
    } finally {
      setLogsLoading(false);
    }
  }, [setAgents, setTasks, setWorkflows, setDepartments]);

  useEffect(() => {
    void fetchCommandCenterSummary();
  }, [fetchCommandCenterSummary]);

  // ── Socket live updates ──────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    connectSocket();
    socket.on('agent:status_updated', (p: { agentId: string; status: string }) => {
      updateAgentStatus(
        p.agentId,
        p.status as import('@/shared/types/domain.types').AgentStatus,
      );
    });
    // Live updates: re-fetch the whole summary on any of these events.
    // (Was 4 separate fetches; now 1 round-trip.)
    socket.on('task:completed', () => void fetchCommandCenterSummary());
    socket.on('task:failed', () => void fetchCommandCenterSummary());
    socket.on('approval:pending', () => void fetchCommandCenterSummary());
    return () => {
      socket.off('agent:status_updated');
      socket.off('task:completed');
      socket.off('task:failed');
      socket.off('approval:pending');
    };
  }, [updateAgentStatus, fetchCommandCenterSummary]);

  // ── Derived data ─────────────────────────────────────────────────────
  const runningAgents = agents.filter((a) => a.status === 'ACTIVE' || a.status === 'RUNNING').length;
  const completedToday = tasks.filter(
    (t) =>
      t.status === 'COMPLETED' &&
      t.completedAt &&
      new Date(t.completedAt).toDateString() === new Date().toDateString(),
  ).length;
  const failedTasks = tasks.filter((t) => t.status === 'FAILED').length;

  const taskStatusDonut: DonutSlice[] = [
    { name: 'Completed', value: completedToday, color: '#22c55e' },
    { name: 'Running', value: tasks.filter((t) => t.status === 'RUNNING' || t.status === 'IN_PROGRESS').length, color: '#3b82f6' },
    { name: 'Pending', value: tasks.filter((t) => t.status === 'PENDING').length, color: '#a855f7' },
    { name: 'Failed', value: failedTasks, color: '#ef4444' },
  ].filter((s) => s.value > 0);

  // ── Hero message submit ──────────────────────────────────────────────
  const handleSendMessage = (e: FormEvent) => {
    e.preventDefault();
    if (!messageInput.trim()) return;
    // Open AI chat with the prefilled message
    setAiChatOpen(true);
    setMessageInput('');
    // The AIChatPanel reads initial message via its own state on next iteration
  };

  // ── Agent count per department (for cards) ───────────────────────────
  const agentCountByDept = new Map<string, number>();
  for (const a of agents) {
    const deptId = (a as { departmentId?: string }).departmentId;
    if (deptId) {
      agentCountByDept.set(deptId, (agentCountByDept.get(deptId) ?? 0) + 1);
    }
  }

  if (!user) return null;

  const firstName = user.firstName ?? 'there';
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 5) return 'Working late';
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    if (h < 21) return 'Good evening';
    return 'Working late';
  })();

  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  return (
    <TenantShell user={user}>
      {/* ── HERO ─────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="hero-gradient rounded-card -mx-6 -mt-6 px-6 pt-10 pb-12 mb-6 border-b border-surface-border"
      >
        <div className="max-w-7xl mx-auto flex flex-col items-center text-center">
          <p className="text-xs uppercase tracking-widest text-zinc-500 mb-2">
            {dateStr} · {timeStr}
          </p>
          <h1 className="text-3xl md:text-4xl font-bold text-zinc-100 tracking-tight">
            {greeting}, <span className="text-accent-500">{firstName}</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-2 max-w-2xl">
            Your command center for the AI workforce. {departments.length} departments · {agents.length} agents · {tasks.length} tasks today.
          </p>

          <form
            onSubmit={handleSendMessage}
            className="mt-6 w-full max-w-2xl flex items-center gap-2 rounded-card border border-surface-border bg-surface-raised/80 backdrop-blur px-4 py-3 shadow-creatio-md focus-within:border-accent-500 transition-colors"
          >
            <Sparkles className="w-4 h-4 text-accent-500 shrink-0" />
            <input
              value={messageInput}
              onChange={(e) => setMessageInput(e.target.value)}
              type="text"
              placeholder="Ask any agent or department… e.g. 'What's the status of my Sales team?'"
              className="flex-1 bg-transparent text-sm text-zinc-100 placeholder-zinc-500 outline-none"
              aria-label="Message to CEO agent"
            />
            <button
              type="submit"
              disabled={!messageInput.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium disabled:opacity-50 transition"
              aria-label="Send"
            >
              <Send className="w-3 h-3" />
              Ask
            </button>
            <DailyBriefingButton onClick={() => setBriefingOpen(true)} />
          </form>
        </div>
      </motion.section>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* ── KPI STRIP ─────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <KpiCard
            label="Active Agents"
            value={agents.length}
            delta={runningAgents}
            deltaLabel={`${runningAgents} running`}
            color="ops"
            icon={<Users className="w-4 h-4" />}
            loading={kpisLoading}
            onClick={() => router.push('/marketplace?tab=agents')}
          />
          <KpiCard
            label="Tasks Today"
            value={completedToday}
            delta={kpis?.successRate}
            deltaLabel="% success"
            color="profit"
            icon={<CheckCircle2 className="w-4 h-4" />}
            loading={kpisLoading}
            onClick={() => router.push('/departments?tab=tasks')}
          />
          <KpiCard
            label="Cost MTD"
            value={monthCost !== null ? `$${monthCost.toFixed(2)}` : '—'}
            color="warn"
            icon={<Wallet className="w-4 h-4" />}
            loading={kpisLoading}
            onClick={() => router.push('/finance')}
          />
          <KpiCard
            label="Pending Approvals"
            value={pendingApprovals}
            color="risk"
            icon={<AlertCircle className="w-4 h-4" />}
            loading={kpisLoading}
            onClick={() => router.push('/service-desk?tab=approvals')}
          />
        </motion.div>

        {/* ── PHASE 2: IMPACT TIMELINE SECTION ─────────────────── */}
        {showTimeline && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent-500" />
                Impact Timeline
              </h2>
              <button
                onClick={() => setShowTimeline(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition"
              >
                Hide
              </button>
            </div>

            <div className="card-surface p-4">
              <TimelineFilter
                activeFilter={timelineFilter}
                onFilterChange={setTimelineFilter}
                searchTerm={timelineSearch}
                onSearchChange={setTimelineSearch}
                eventCounts={timelineEventCounts}
                className="mb-4"
              />

              <ImpactTimeline
                events={timelineEvents}
                isLoading={timelineLoading}
                isEmpty={timelineEvents.length === 0}
                onEventClick={(eventId) => {
                  // Navigate to event detail or open inspector
                  console.log('Event clicked:', eventId);
                }}
                onActionClick={(eventType, target) => {
                  if (target) {
                    router.push(target);
                  }
                }}
                maxHeight="max-h-[500px]"
              />
            </div>
          </motion.div>
        )}

        {/* ── DEPARTMENT CARDS GRID + ACTIVITY ───────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Department cards */}
          <div className="xl:col-span-2 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-accent-500" />
                Your Departments
              </h2>
              <button
                onClick={() => void fetchCommandCenterSummary()}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1"
                aria-label="Refresh"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>

            {departments.length === 0 ? (
              <div className="card-surface p-12 text-center">
                <Building2 className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
                <p className="text-sm text-zinc-300 font-medium">No departments yet</p>
                <p className="text-xs text-zinc-500 mt-1">
                  Deploy a department template to start building your AI org.
                </p>
                <Link
                  href="/onboarding/setup"
                  className="inline-block mt-4 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium transition"
                >
                  Setup Departments
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {departments.map((dept, idx) => {
                  const accent = DEPT_ACCENT_BY_INDEX[idx % DEPT_ACCENT_BY_INDEX.length];
                  const deptAgents = agents.filter(
                    (a) => (a as { departmentId?: string }).departmentId === dept.id,
                  );
                  const runningCount = deptAgents.filter(
                    (a) => a.status === 'ACTIVE' || a.status === 'RUNNING',
                  ).length;
                  return (
                    <Link
                      key={dept.id}
                      href={`/departments/${encodeURIComponent(dept.id)}/workspace`}
                      className="card-surface card-interactive p-4 group block"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${accent === 'accent' ? 'bg-accent-500/15 text-accent-500' :
                              accent === 'success' ? 'bg-state-success/15 text-state-success' :
                                accent === 'warning' ? 'bg-state-warning/15 text-state-warning' :
                                  accent === 'info' ? 'bg-state-info/15 text-state-info' :
                                    'bg-status-strategy/15 text-status-strategy'
                            }`}>
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-zinc-100 truncate">{dept.name}</h3>
                            {dept.description && (
                              <p className="text-xs text-zinc-500 truncate">{dept.description}</p>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-400">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {dept.agentCount ?? deptAgents.length} agents
                        </span>
                        {runningCount > 0 && (
                          <StatusBadge status="RUNNING" label="Live" />
                        )}
                        <span className="ml-auto text-zinc-500">
                          {dept.harmonyScore != null && `Harmony ${dept.harmonyScore}%`}
                        </span>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>

          {/* Activity timeline */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-accent-500" />
                Live Activity
              </h2>
              <button
                onClick={() => void fetchCommandCenterSummary()}
                className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1"
                aria-label="Refresh activity"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>
            <div className="card-surface p-2 max-h-[480px] overflow-y-auto">
              {logsLoading ? (
                <div className="py-8 text-center text-zinc-500 text-xs">Loading…</div>
              ) : logs.length === 0 ? (
                <div className="py-8 text-center text-zinc-500 text-xs">No activity yet</div>
              ) : (
                <ul className="space-y-1">
                  {logs.map((log) => (
                    <li
                      key={log.id}
                      onClick={() => log.taskId && openInspector('task', log.taskId)}
                      className="flex items-center gap-2.5 p-2 rounded-md hover:bg-surface-overlay cursor-pointer transition"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${log.status === 'COMPLETED' ? 'bg-state-success' :
                          log.status === 'FAILED' ? 'bg-state-danger' :
                            log.status === 'RUNNING' ? 'bg-state-info' :
                              'bg-zinc-500'
                        }`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-zinc-200 truncate">
                          {log.agent?.name ?? log.agentId.slice(0, 8)}
                        </p>
                        <p className="text-[10px] text-zinc-500">
                          {new Date(log.startedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                      <StatusBadge status={log.status} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* ── CHARTS ROW ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 card-surface p-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-status-strategy" />
                Task Volume
              </h2>
              <div className="flex gap-1">
                {RANGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setRange(opt.value)}
                    className={`px-2.5 py-1 rounded-md text-xs transition ${range === opt.value
                        ? 'bg-accent-500 text-white'
                        : 'text-zinc-500 hover:text-zinc-300 hover:bg-surface-overlay'
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            <AreaChart
              data={taskTimeSeries}
              dataKey="value"
              xKey="timestamp"
              color="#8b5cf6"
              loading={chartLoading}
              height={180}
            />
          </div>

          <div className="card-surface p-4">
            <h2 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-status-ops" />
              Task Status
            </h2>
            <DonutChart
              data={
                taskStatusDonut.length > 0
                  ? taskStatusDonut
                  : [{ name: 'No data', value: 1, color: '#3f3f46' }]
              }
              nameKey="name"
              valueKey="value"
              loading={false}
              height={180}
            />
          </div>
        </div>

        {/* ── QUICK ACTIONS ─────────────────────────────────────── */}
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-accent-500" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <QuickAction
              label="Spawn Agent"
              description="Add a new AI agent from the library"
              icon={<Sparkles className="w-5 h-5" />}
              accent="accent"
              href="/marketplace?tab=spawn"
            />
            <QuickAction
              label="Manage Teams"
              description="Departments, agents, members"
              icon={<Users2 className="w-5 h-5" />}
              accent="success"
              href="/departments"
            />
            <QuickAction
              label="Tasks"
              description="View and assign tasks"
              icon={<ListTodo className="w-5 h-5" />}
              accent="info"
              href="/departments?tab=tasks"
              badge={tasks.filter((t) => t.status === 'PENDING').length || undefined}
            />
            <QuickAction
              label="Projects"
              description="Track active initiatives"
              icon={<Briefcase className="w-5 h-5" />}
              accent="warning"
              href="/departments?tab=projects"
            />
            <QuickAction
              label="Goals"
              description="Objectives & progress"
              icon={<Target className="w-5 h-5" />}
              accent="success"
              href="/departments?tab=goals"
            />
            <QuickAction
              label="Service Desk"
              description="Inbox, approvals, support"
              icon={<Headphones className="w-5 h-5" />}
              accent="info"
              href="/service-desk"
              badge={pendingApprovals + (agentInboxCount ?? 0) || undefined}
            />
          </div>
        </div>

        {/* ── ACTIVE AGENTS PREVIEW ────────────────────────────── */}
        <div className="card-surface">
          <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
              <Users className="w-4 h-4 text-status-ops" />
              Active Agents
            </h2>
            <span className="text-xs text-zinc-500">{runningAgents} running of {agents.length}</span>
          </div>
          <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
            {agents.length === 0 ? (
              <p className="text-xs text-zinc-500 py-4 text-center">No agents yet</p>
            ) : (
              agents.slice(0, 5).map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={{
                    id: agent.id,
                    name: agent.name,
                    type: (agent as { type?: string }).type ?? 'FUNCTIONAL',
                    status: agent.status as never,
                    department: (agent as { department?: { name?: string } }).department?.name,
                    model: 'gpt-4o',
                    workload: 0,
                    taskCount: 0,
                    successRate: 0,
                    budgetUsed: 0,
                    budgetTotal: 100,
                    lastActiveAt: (agent as { updatedAt?: string }).updatedAt,
                  }}
                  variant="compact"
                  onAction={(action, id) => {
                    if (action === 'inspect') openInspector('agent', id);
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Floating AI Chat ──────────────────────────────────── */}
      <div className="fixed bottom-6 right-6 z-40">
        <AIChatButton onClick={() => setAiChatOpen(true)} />
      </div>

      {/* ── Overlay panels ────────────────────────────────────── */}
      <DailyBriefingModal isOpen={briefingOpen} onClose={() => setBriefingOpen(false)} />
      <AIChatPanel isOpen={aiChatOpen} onClose={() => setAiChatOpen(false)} />
    </TenantShell>
  );
}