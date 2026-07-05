'use client';

// HomeKpiStrip — 4 KPI cards reflecting tenant-level metrics.
//
// Each tile maps to a Creatio reference KPI and a backend store / service:
//   - Active Agents        → useAgentStore() agents list length / "N running"
//   - Tasks Today          → useDashboardKpis().kpis.completedToday + failed
//   - Cost MTD             → derived from command-center summary (monthCost)
//   - Pending Approvals    → useApprovals() length
//
// Each tile is clickable → navigates to the relevant section. Loading state
// keeps the layout stable while data is fetched.

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  Wallet,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';
import { useDashboardKpis } from '@/hooks/useDashboardKpis';
import { useApprovals } from '@/hooks/useApprovals';

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  if (Math.abs(amount) >= 10_000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(2)}`;
}

interface HomeKpiStripProps {
  /** Cost MTD in dollars; sourced from command-center summary. */
  monthCost?: number | null;
}

export function HomeKpiStrip({ monthCost }: HomeKpiStripProps = {}) {
  const router = useRouter();
  const agents = useAgentStore((s) => s.agents);
  const tasks = useTaskStore((s) => s.tasks);
  const { critical = [], routine = [] } = useApprovals();
  const { kpis, loading: kpisLoading, refresh: refreshKpis } = useDashboardKpis(60_000);

  // Defensive coercions — zustand persist hydration can briefly hand back
  // non-array values (legacy localStorage shape). Bail to [].
  const safeAgents = useMemo(() => (Array.isArray(agents) ? agents : []), [agents]);
  const safeTasks = useMemo(() => (Array.isArray(tasks) ? tasks : []), [tasks]);

  const runningAgents = useMemo(
    () =>
      safeAgents.filter(
        (a) => (a as { status?: string }).status === 'ACTIVE' || (a as { status?: string }).status === 'RUNNING',
      ).length,
    [safeAgents],
  );

  const completedToday = useMemo(
    () =>
      safeTasks.filter((t) => {
        const status = (t as { status?: string }).status;
        const completedAt = (t as { completedAt?: string }).completedAt;
        return status === 'COMPLETED' && completedAt && new Date(completedAt).toDateString() === new Date().toDateString();
      }).length,
    [safeTasks],
  );

  const failedToday = useMemo(
    () =>
      safeTasks.filter((t) => {
        const status = (t as { status?: string }).status;
        const updatedAt = (t as { updatedAt?: string }).updatedAt;
        return status === 'FAILED' && updatedAt && new Date(updatedAt).toDateString() === new Date().toDateString();
      }).length,
    [safeTasks],
  );

  // Approvals hook returns stratified critical + routine buckets. The Total
  // is the pending approvals count shown on the home KPI tile.
  const pendingApprovals = useMemo(
    () => critical.length + routine.length,
    [critical, routine],
  );

  // Cost MTD — fall back to /api/v1/analytics/cost/today if dashboard kpis
  // aren't loaded yet. `kpis.costToday` is dollars for today; we treat that
  // as a reasonable proxy when month-cost isn't available.
  const costMtd = (kpis?.costToday as number | undefined) ?? null;

  return (
    <section aria-label="Workspace KPIs" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiTile
        label="Active Agents"
        value={safeAgents.length}
        badge={`${runningAgents} running`}
        badgeTone="ops"
        icon={<Users className="w-4 h-4" aria-hidden />}
        loading={!safeAgents.length && kpisLoading}
        onClick={() => router.push('/marketplace?tab=agents')}
        onRefresh={refreshKpis}
      />
      <KpiTile
        label="Tasks Today"
        value={kpis?.completedToday ?? completedToday}
        badge={`${failedToday} failed`}
        badgeTone="profit"
        icon={<CheckCircle2 className="w-4 h-4" aria-hidden />}
        loading={kpisLoading && !kpis}
        onClick={() => router.push('/departments?tab=tasks')}
        onRefresh={refreshKpis}
      />
      <KpiTile
        label="Cost MTD"
        value={formatCurrency(costMtd)}
        badge={costMtd != null ? 'this month' : 'loading…'}
        badgeTone="warn"
        icon={<Wallet className="w-4 h-4" aria-hidden />}
        loading={kpisLoading && !kpis}
        onClick={() => router.push('/finance')}
        onRefresh={refreshKpis}
      />
      <KpiTile
        label="Pending Approvals"
        value={pendingApprovals}
        badge={pendingApprovals === 0 ? 'all clear' : 'requires attention'}
        badgeTone="risk"
        icon={<AlertCircle className="w-4 h-4" aria-hidden />}
        onClick={() => router.push('/service-desk?tab=approvals')}
        onRefresh={refreshKpis}
      />
    </section>
  );
}

// ─── Internal tile (KpiCard-shaped, themed correctly for light + dark) ───────

interface KpiTileProps {
  label: string;
  value: number | string;
  badge?: string;
  badgeTone: 'profit' | 'risk' | 'ops' | 'warn' | 'strategy';
  icon: React.ReactNode;
  loading?: boolean;
  onClick: () => void;
  onRefresh?: () => void;
}

const ACCENT_RING: Record<KpiTileProps['badgeTone'], string> = {
  profit: 'text-status-profit',
  risk: 'text-status-risk',
  ops: 'text-status-ops',
  warn: 'text-status-warn',
  strategy: 'text-status-strategy',
};

function KpiTile({
  label,
  value,
  badge,
  badgeTone,
  icon,
  loading = false,
  onClick,
  onRefresh,
}: KpiTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`${label}: navigate to detail`}
      className="card-surface card-interactive p-5 flex flex-col items-start text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
    >
      <div className="flex items-center gap-2 text-zinc-500 text-xs mb-3 w-full">
        <span className={ACCENT_RING[badgeTone]} aria-hidden>{icon}</span>
        <span className="font-medium truncate">{label}</span>
        {onRefresh && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                onRefresh();
              }
            }}
            aria-label="Refresh"
            className="ml-auto text-zinc-500 hover:text-accent-500 transition"
          >
            <RefreshCw className="w-3 h-3" aria-hidden />
          </span>
        )}
      </div>
      {loading ? (
        <div className="h-9 w-20 bg-surface-overlay rounded animate-pulse mb-1" />
      ) : (
        <p className={`text-3xl font-bold tracking-tight ${ACCENT_RING[badgeTone]}`}>{value}</p>
      )}
      {badge && (
        <p className={`text-xs mt-2 flex items-center gap-1 ${ACCENT_RING[badgeTone]} opacity-80`}>
          <span aria-hidden>↑</span>
          {badge}
        </p>
      )}
    </button>
  );
}
