'use client';

/**
 * /intelligence — Unified Intelligence page (Phase 8)
 *
 * Consolidates analytics + observability + health + reliability + security + settings.
 * 6 tabs:
 *   1. Analytics      — KPIs + 4 time-series charts + cost donut + eval quality
 *   2. Observability  — KPIs (latency, errors, requests) + activity timeline
 *   3. Health         — system health checks + circuit breakers
 *   4. Reliability    — quota usage + spending cap
 *   5. Security       — events + rate limits
 *   6. Settings       — user profile + AI providers + API keys (links to /settings)
 *
 * Layout (Creatio-style with 6 tabs):
 *   ┌─ Header ─────────────────────────────────────────────┐
 *   │  [BarChart3 icon] Intelligence                       │
 *   ├─ Tabs ────────────────────────────────────────────────┤
 *   │  Analytics │ Observability │ Health │ Reliability │
 *   │  Security │ Settings                              │
 *   ├─ Tab content ────────────────────────────────────────┤
 *   │  (active tab)                                       │
 *   └─────────────────────────────────────────────────────┘
 */

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import {
  BarChart3,
  Activity,
  HeartPulse,
  ShieldCheck,
  Shield,
  Settings,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Cpu,
  Wallet,
  Zap,
  Lock,
  Key,
  User,
  ExternalLink,
  RefreshCw,
} from 'lucide-react';

import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import { AreaChart } from '@/components/charts/AreaChart';
import { LineChart as LineChartComponent } from '@/components/charts/LineChart';
import { BarChart } from '@/components/charts/BarChart';
import { DonutChart } from '@/components/charts/DonutChart';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { useChartData } from '@/hooks/useChartData';
import { useTimeRange } from '@/hooks/useTimeRange';

// ─── Types ────────────────────────────────────────────────────────────────
type IntelTab = 'analytics' | 'observability' | 'health' | 'reliability' | 'security' | 'settings';

interface HealthCheck {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  message?: string;
}

interface CircuitBreaker {
  name: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount?: number;
  successCount?: number;
}

interface QuotaInfo {
  used: number;
  limit: number;
  unit: string;
  resetsAt?: string;
}

interface SecurityEvent {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  source?: string;
  createdAt: string;
}

const TABS: { id: IntelTab; label: string; icon: typeof BarChart3 }[] = [
  { id: 'analytics',     label: 'Analytics',     icon: BarChart3 },
  { id: 'observability', label: 'Observability', icon: Activity },
  { id: 'health',        label: 'Health',        icon: HeartPulse },
  { id: 'reliability',   label: 'Reliability',   icon: ShieldCheck },
  { id: 'security',      label: 'Security',      icon: Shield },
  { id: 'settings',      label: 'Settings',      icon: Settings },
];

const RANGE_OPTIONS = [
  { label: '24 h', value: '24h' as const },
  { label: '7 d',  value: '7d' as const },
  { label: '30 d', value: '30d' as const },
];

// ─── Page ─────────────────────────────────────────────────────────────────
export default function IntelligencePage() {
  const user = useTenantAuth();
  const [activeTab, setActiveTab] = useState<IntelTab>('analytics');

  // Read tab from URL
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = new URL(window.location.href).searchParams.get('tab') as IntelTab | null;
    if (t && TABS.find((tab) => tab.id === t)) setActiveTab(t);
  }, []);

  const setTab = (t: IntelTab) => {
    setActiveTab(t);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('tab', t);
      window.history.replaceState(null, '', url.toString());
    }
  };

  if (!user) return null;

  return (
    <TenantShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        {/* ── Page Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-status-strategy/15 text-status-strategy flex items-center justify-center">
              <BarChart3 className="w-5 h-5" />
            </div>
            Intelligence
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Analytics, observability, health, reliability, and security — all in one place.
          </p>
        </motion.div>

        {/* ── Tab Navigation ──────────────────────────────────── */}
        <div className="border-b border-surface-border">
          <nav className="flex items-center gap-1 -mb-px overflow-x-auto">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                    active
                      ? 'border-accent-500 text-zinc-100'
                      : 'border-transparent text-zinc-500 hover:text-zinc-300 hover:border-surface-border'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* ── Tab Content ─────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'analytics' && <AnalyticsTab />}
            {activeTab === 'observability' && <ObservabilityTab />}
            {activeTab === 'health' && <HealthTab />}
            {activeTab === 'reliability' && <ReliabilityTab />}
            {activeTab === 'security' && <SecurityTab />}
            {activeTab === 'settings' && <SettingsTab />}
          </motion.div>
        </AnimatePresence>
      </div>
    </TenantShell>
  );
}

// ─── Tab 1: Analytics ─────────────────────────────────────────────────────
function AnalyticsTab() {
  const { kpis, loading: kpisLoading } = useDashboardKpis();
  const { range, setRange } = useTimeRange();
  const { data: taskData, loading: taskLoading } = useChartData('tasks', range);
  const { data: errorData, loading: errorLoading } = useChartData('errors', range);
  const { data: costData, loading: costLoading } = useChartData('cost', range);
  const { data: agentData, loading: agentLoading } = useChartData('agents', range);

  const costDonut = [
    { name: 'Compute',  value: 45, color: '#6366f1' },
    { name: 'Storage',  value: 20, color: '#8b5cf6' },
    { name: 'API Calls', value: 30, color: '#06b6d4' },
    { name: 'Other',    value: 5,  color: '#3f3f46' },
  ];

  return (
    <div className="space-y-5">
      {/* Toolbar with range selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-status-strategy" />
          Operational metrics
        </h2>
        <div className="flex gap-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                range === opt.value
                  ? 'bg-accent-500 text-white'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Success Rate" value={kpis ? `${kpis.successRate}%` : '—'} color="profit" icon={<CheckCircle2 className="w-4 h-4" />} loading={kpisLoading} />
        <KpiCard label="Total Tasks" value={kpis?.totalTasks ?? '—'} color="ops" icon={<Activity className="w-4 h-4" />} loading={kpisLoading} />
        <KpiCard label="Failed Tasks" value={kpis?.failedTasks ?? '—'} color="risk" icon={<AlertTriangle className="w-4 h-4" />} loading={kpisLoading} />
        <KpiCard label="Avg Cost / Task" value={kpis?.avgCostPerTask != null ? `$${kpis.avgCostPerTask.toFixed(2)}` : '—'} color="warn" icon={<Wallet className="w-4 h-4" />} loading={kpisLoading} />
      </div>

      {/* Charts grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Task Volume" icon={<Activity className="w-4 h-4 text-status-ops" />}>
          <AreaChart data={taskData} dataKey="value" xKey="timestamp" color="#8b5cf6" loading={taskLoading} height={200} />
        </ChartCard>
        <ChartCard title="Error Rate" icon={<AlertTriangle className="w-4 h-4 text-state-danger" />}>
          <AreaChart data={errorData} dataKey="value" xKey="timestamp" color="#ef4444" loading={errorLoading} height={200} />
        </ChartCard>
        <ChartCard title="Cost Trend (USD)" icon={<Wallet className="w-4 h-4 text-state-success" />}>
          <LineChartComponent data={costData} dataKey="value" xKey="timestamp" color="#22c55e" loading={costLoading} height={200} />
        </ChartCard>
        <ChartCard title="Active Agents" icon={<Cpu className="w-4 h-4 text-status-strategy" />}>
          <LineChartComponent data={agentData} dataKey="value" xKey="timestamp" color="#06b6d4" loading={agentLoading} height={200} />
        </ChartCard>
      </div>

      {/* Cost breakdown + eval quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Cost Breakdown" icon={<Wallet className="w-4 h-4 text-state-warning" />}>
          <DonutChart data={costDonut} nameKey="name" valueKey="value" loading={false} height={200} />
        </ChartCard>
        <ChartCard title="Evaluation Quality" icon={<CheckCircle2 className="w-4 h-4 text-state-profit" />}>
          <BarChart
            data={[
              { label: '0–50%', value: 5, color: '#ef4444' },
              { label: '50–70%', value: 12, color: '#f59e0b' },
              { label: '70–85%', value: 38, color: '#3b82f6' },
              { label: '85–95%', value: 62, color: '#22c55e' },
              { label: '95–100%', value: 28, color: '#10b981' },
            ]}
            dataKey="value"
            xKey="label"
            loading={false}
            height={200}
          />
        </ChartCard>
      </div>
    </div>
  );
}

// ─── Tab 2: Observability ────────────────────────────────────────────────
function ObservabilityTab() {
  const { range, setRange } = useTimeRange();
  const { data: latencyData, loading: latencyLoading } = useChartData('latency', range);
  const { data: requestData, loading: requestLoading } = useChartData('requests', range);
  const [events, setEvents] = useState<{ id: string; type: string; message: string; severity: string; timestamp: string }[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const fetchEvents = useCallback(async () => {
    setEventsLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch('/api/v1/observability/logs?limit=30', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) { setEvents([]); return; }
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : (Array.isArray(json?.data?.data) ? json.data.data : []);
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setEventsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Activity className="w-4 h-4 text-status-ops" />
          Live observability
        </h2>
        <div className="flex items-center gap-2">
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setRange(opt.value)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition ${
                  range === opt.value
                    ? 'bg-accent-500 text-white'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchEvents()}>
            Refresh
          </ActionButton>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Avg Latency" value="—" color="ops" icon={<Zap className="w-4 h-4" />} />
        <KpiCard label="Requests" value="—" color="profit" icon={<Activity className="w-4 h-4" />} />
        <KpiCard label="Errors" value="—" color="risk" icon={<AlertTriangle className="w-4 h-4" />} />
        <KpiCard label="Throughput" value="—" color="strategy" icon={<TrendingUp className="w-4 h-4" />} />
      </div>

      {/* Latency + request charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="P95 Latency (ms)" icon={<Zap className="w-4 h-4 text-status-ops" />}>
          <LineChartComponent data={latencyData} dataKey="value" xKey="timestamp" color="#3b82f6" loading={latencyLoading} height={200} />
        </ChartCard>
        <ChartCard title="Requests / minute" icon={<Activity className="w-4 h-4 text-state-success" />}>
          <AreaChart data={requestData} dataKey="value" xKey="timestamp" color="#22c55e" loading={requestLoading} height={200} />
        </ChartCard>
      </div>

      {/* Event stream */}
      <div className="card-surface">
        <div className="px-5 py-3 border-b border-surface-border flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
            <Activity className="w-4 h-4 text-state-info" />
            Event stream
          </h3>
          <span className="text-xs text-zinc-500">{events.length} events</span>
        </div>
        <div className="divide-y divide-surface-border max-h-96 overflow-y-auto">
          {eventsLoading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Loading…</div>
          ) : events.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">No events yet</div>
          ) : (
            events.map((e) => (
              <div key={e.id} className="px-5 py-2.5 text-xs flex items-center gap-3">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  e.severity === 'error' ? 'bg-state-danger' :
                  e.severity === 'warn' ? 'bg-state-warning' :
                  'bg-state-info'
                }`} />
                <span className="font-mono text-zinc-500 w-32 shrink-0">{new Date(e.timestamp).toLocaleTimeString()}</span>
                <span className="font-medium text-zinc-300">{e.type}</span>
                <span className="text-zinc-500 truncate">{e.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 3: Health ────────────────────────────────────────────────────────
function HealthTab() {
  const [checks, setChecks] = useState<HealthCheck[]>([]);
  const [breakers, setBreakers] = useState<CircuitBreaker[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const [healthRes, breakersRes] = await Promise.all([
        fetch('/api/v1/health/system', { headers }),
        fetch('/api/v1/health/circuit-breakers', { headers }),
      ]);

      if (healthRes.ok) {
        const data = await healthRes.json();
        const sysData = data?.data ?? {};
        const list: HealthCheck[] = [
          { service: 'Database',     status: sysData.database === 'up' ? 'healthy' : 'degraded', latencyMs: sysData.dbLatencyMs },
          { service: 'Redis',        status: sysData.redis === 'up' ? 'healthy' : 'degraded' },
          { service: 'Queue',        status: sysData.queue === 'up' ? 'healthy' : 'degraded' },
          { service: 'AI Gateway',   status: sysData.aiGateway === 'up' ? 'healthy' : 'degraded' },
        ];
        setChecks(list);
      }

      if (breakersRes.ok) {
        const data = await breakersRes.json();
        setBreakers(Array.isArray(data?.data) ? data.data : []);
      }
    } catch {
      setChecks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchHealth(); }, [fetchHealth]);

  const healthyCount = checks.filter((c) => c.status === 'healthy').length;
  const unhealthyCount = checks.filter((c) => c.status === 'unhealthy').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <HeartPulse className="w-4 h-4 text-state-success" />
          System health
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchHealth()}>
          Refresh
        </ActionButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Services" value={checks.length} color="ops" loading={loading} />
        <KpiCard label="Healthy" value={healthyCount} color="profit" loading={loading} />
        <KpiCard label="Degraded" value={checks.filter((c) => c.status === 'degraded').length} color="warn" loading={loading} />
        <KpiCard label="Unhealthy" value={unhealthyCount} color="risk" loading={loading} />
      </div>

      {/* Service health */}
      <div className="card-surface">
        <div className="px-5 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-zinc-200">Service status</h3>
        </div>
        <div className="divide-y divide-surface-border">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Loading…</div>
          ) : checks.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">No service data available</div>
          ) : (
            checks.map((c) => (
              <div key={c.service} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  c.status === 'healthy' ? 'bg-state-success' :
                  c.status === 'degraded' ? 'bg-state-warning animate-pulse' :
                  'bg-state-danger'
                }`} />
                <span className="text-sm font-medium text-zinc-200 flex-1">{c.service}</span>
                {c.latencyMs != null && (
                  <span className="text-xs font-mono text-zinc-500">{c.latencyMs}ms</span>
                )}
                <StatusBadge status={c.status === 'healthy' ? 'ACTIVE' : c.status === 'degraded' ? 'WARNING' : 'FAILED'} />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Circuit breakers */}
      <div className="card-surface">
        <div className="px-5 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-zinc-200">Circuit breakers</h3>
        </div>
        <div className="divide-y divide-surface-border">
          {breakers.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">
              No circuit breakers configured
            </div>
          ) : (
            breakers.map((b) => (
              <div key={b.name} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  b.state === 'CLOSED' ? 'bg-state-success' :
                  b.state === 'HALF_OPEN' ? 'bg-state-warning animate-pulse' :
                  'bg-state-danger'
                }`} />
                <span className="text-sm font-medium text-zinc-200 flex-1">{b.name}</span>
                {b.failureCount != null && (
                  <span className="text-xs font-mono text-zinc-500">{b.failureCount} fail / {b.successCount ?? 0} ok</span>
                )}
                <StatusBadge status={b.state === 'CLOSED' ? 'ACTIVE' : b.state === 'HALF_OPEN' ? 'WARNING' : 'FAILED'} label={b.state} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 4: Reliability ──────────────────────────────────────────────────
function ReliabilityTab() {
  const [quotas, setQuotas] = useState<QuotaInfo[]>([]);
  const [spendingCap, setSpendingCap] = useState<{ used: number; cap: number; currency: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;

      const [quotaRes, capRes] = await Promise.all([
        window.fetch('/api/v1/reliability/quota', { headers }),
        window.fetch('/api/v1/reliability/spending-cap', { headers }),
      ]);

      if (quotaRes.ok) {
        const data = await quotaRes.json();
        const list = Array.isArray(data?.data) ? data.data : [];
        setQuotas(list);
      }
      if (capRes.ok) {
        const data = await capRes.json();
        setSpendingCap(data?.data ?? null);
      }
    } catch {
      // empty
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-state-info" />
          Reliability & quotas
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchAll()}>
          Refresh
        </ActionButton>
      </div>

      {/* Spending cap */}
      {spendingCap && (
        <div className="card-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-zinc-200">Monthly spending cap</h3>
            <span className="text-2xl font-bold text-zinc-100">
              ${spendingCap.used.toFixed(2)} <span className="text-sm text-zinc-500 font-normal">/ ${spendingCap.cap.toFixed(2)}</span>
            </span>
          </div>
          <div className="h-3 rounded-full bg-surface-overlay overflow-hidden">
            <div
              className={`h-full transition-all ${
                (spendingCap.used / spendingCap.cap) > 0.8
                  ? 'bg-state-danger'
                  : (spendingCap.used / spendingCap.cap) > 0.5
                  ? 'bg-state-warning'
                  : 'bg-accent-500'
              }`}
              style={{ width: `${Math.min(100, (spendingCap.used / spendingCap.cap) * 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500 mt-2">
            {((spendingCap.used / spendingCap.cap) * 100).toFixed(1)}% of monthly budget used
          </p>
        </div>
      )}

      {/* Quota list */}
      <div className="card-surface">
        <div className="px-5 py-3 border-b border-surface-border">
          <h3 className="text-sm font-semibold text-zinc-200">Resource quotas</h3>
        </div>
        <div className="divide-y divide-surface-border">
          {loading ? (
            <div className="p-8 text-center text-zinc-500 text-xs">Loading…</div>
          ) : quotas.length === 0 ? (
            <div className="p-8 text-center text-zinc-500 text-xs">No quota data available</div>
          ) : (
            quotas.map((q, idx) => {
              const pct = (q.used / q.limit) * 100;
              return (
                <div key={idx} className="px-5 py-3">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-zinc-300">{q.unit}</span>
                    <span className="font-mono text-zinc-500">
                      {q.used.toLocaleString()} / {q.limit.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-surface-overlay overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        pct > 80 ? 'bg-state-danger' : pct > 50 ? 'bg-state-warning' : 'bg-accent-500'
                      }`}
                      style={{ width: `${Math.min(100, pct)}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Tab 5: Security ──────────────────────────────────────────────────────
function SecurityTab() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'critical' | 'high' | 'medium' | 'low'>('ALL');

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
      const res = await fetch('/api/v1/security/events?limit=100', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!res.ok) { setEvents([]); return; }
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : [];
      setEvents(list);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEvents(); }, [fetchEvents]);

  const visible = events.filter((e) => severityFilter === 'ALL' || e.severity === severityFilter);
  const criticalCount = events.filter((e) => e.severity === 'critical').length;

  const severityColor = (s: string) => {
    switch (s) {
      case 'critical': return 'text-state-danger';
      case 'high':     return 'text-state-warning';
      case 'medium':   return 'text-state-info';
      default:         return 'text-zinc-400';
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Shield className="w-4 h-4 text-state-danger" />
          Security events
        </h2>
        <ActionButton variant="ghost" size="sm" icon={<RefreshCw className="w-3 h-3" />} onClick={() => void fetchEvents()}>
          Refresh
        </ActionButton>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total" value={events.length} color="ops" loading={loading} />
        <KpiCard label="Critical" value={criticalCount} color="risk" loading={loading} />
        <KpiCard label="High" value={events.filter((e) => e.severity === 'high').length} color="warn" loading={loading} />
        <KpiCard label="Medium" value={events.filter((e) => e.severity === 'medium').length} color="neutral" loading={loading} />
      </div>

      {/* Severity filter */}
      <div className="flex gap-1">
        {(['ALL', 'critical', 'high', 'medium', 'low'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSeverityFilter(s)}
            className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition ${
              severityFilter === s
                ? 'bg-accent-500 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-surface-overlay border border-surface-border'
            }`}
          >
            {s.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Events list */}
      {loading ? (
        <div className="card-surface p-8 text-center text-zinc-500 text-sm">Loading…</div>
      ) : visible.length === 0 ? (
        <div className="card-surface p-12 text-center">
          <Shield className="w-10 h-10 text-zinc-600 mx-auto mb-3" />
          <p className="text-sm text-zinc-300 font-medium">
            {events.length === 0 ? 'No security events' : 'No events match your filter'}
          </p>
          <p className="text-xs text-zinc-500 mt-1 max-w-md mx-auto">
            Security events (auth attempts, rate-limit hits, suspicious activity) appear here.
          </p>
        </div>
      ) : (
        <div className="card-surface divide-y divide-surface-border">
          {visible.map((e) => (
            <div key={e.id} className="flex items-start gap-3 px-4 py-3">
              <AlertCircle className={`w-4 h-4 mt-0.5 shrink-0 ${severityColor(e.severity)}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-zinc-200">{e.type}</p>
                  <StatusBadge status={e.severity === 'critical' ? 'FAILED' : e.severity === 'high' ? 'WARNING' : 'INFO'} label={e.severity} />
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{e.description}</p>
                <p className="text-[10px] text-zinc-600 mt-1">
                  {new Date(e.createdAt).toLocaleString()}
                  {e.source && ` · ${e.source}`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tab 6: Settings (deep-link to /settings) ───────────────────────────
function SettingsTab() {
  const user = useTenantAuth();

  const sections = [
    {
      title: 'Profile',
      icon: User,
      description: 'Update your name, email, and password',
      href: '/settings?tab=profile',
      color: 'bg-accent-500/15 text-accent-500',
    },
    {
      title: 'AI Providers',
      icon: Cpu,
      description: 'Configure OpenAI, Anthropic, OpenRouter, and other LLM providers',
      href: '/settings?tab=ai',
      color: 'bg-state-info/15 text-state-info',
    },
    {
      title: 'API Keys',
      icon: Key,
      description: 'Manage API keys for programmatic access',
      href: '/settings?tab=apikeys',
      color: 'bg-state-warning/15 text-state-warning',
    },
    {
      title: 'Security & Access',
      icon: Lock,
      description: 'Two-factor auth, session management, IP allowlist',
      href: '/settings?tab=security',
      color: 'bg-state-danger/15 text-state-danger',
    },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Settings className="w-4 h-4 text-zinc-400" />
          Settings
        </h2>
      </div>

      {/* Profile card */}
      <div className="card-surface p-5">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-accent-500 flex items-center justify-center text-white font-semibold">
            {(user?.firstName?.[0] ?? user?.email[0] ?? '?').toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-zinc-100 truncate">
              {user?.firstName} {user?.lastName}
            </p>
            <p className="text-xs text-zinc-500 truncate">{user?.email}</p>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              Role: <span className="font-medium">{user?.role}</span>
            </p>
          </div>
          <Link
            href="/settings?tab=profile"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-surface-border text-zinc-300 hover:bg-surface-overlay transition"
          >
            Edit profile
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>
      </div>

      {/* Settings sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.title}
              href={s.href}
              className="card-surface card-interactive p-5 flex items-start gap-3"
            >
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${s.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-zinc-100">{s.title}</h3>
                  <ExternalLink className="w-3 h-3 text-zinc-500" />
                </div>
                <p className="text-xs text-zinc-500 mt-0.5">{s.description}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ─── Helper: ChartCard ────────────────────────────────────────────────────
function ChartCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="card-surface p-4">
      <h3 className="text-sm font-semibold text-zinc-200 mb-4 flex items-center gap-2">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  );
}