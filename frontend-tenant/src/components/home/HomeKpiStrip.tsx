'use client';

// HomeKpiStrip — 4 KPI cards reflecting tenant-level metrics.
//
// Each tile maps to a Creatio reference KPI and a backend store:
//   - Active Agents        → useAgentStore() agents list length / "N running"
//   - Tasks Today          → useTaskStore() tasks list
//   - Cost MTD             → derived from command-center summary (monthCost)
//   - Pending Approvals    → passed from page level (shared store)
//
// Each tile is clickable → navigates to the relevant section.

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Users,
  CheckCircle2,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { useAgentStore } from '@/stores/agentStore';
import { useTaskStore } from '@/stores/taskStore';

function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  if (Math.abs(amount) >= 10_000) {
    return `$${(amount / 1000).toFixed(1)}k`;
  }
  return `$${amount.toFixed(2)}`;
}

interface HomeKpiStripProps {
  monthCost?: number | null;
  pendingApprovals?: number;
  loading?: boolean;
}

export function HomeKpiStrip({ monthCost, pendingApprovals = 0, loading = false }: HomeKpiStripProps = {}) {
  const router = useRouter();
  const agents = useAgentStore((s) => s.agents);
  const tasks = useTaskStore((s) => s.tasks);

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

  const costMtd = monthCost ?? null;

  return (
    <section aria-label="Workspace KPIs" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KpiTile
        label="Active Employees"
        value={safeAgents.length}
        badge={`${runningAgents} running`}
        badgeTone="ops"
        icon={<Users className="w-4 h-4" aria-hidden />}
        loading={loading}
        onClick={() => router.push('/marketplace?tab=agents')}
      />
      <KpiTile
        label="Tasks Today"
        value={completedToday}
        badge={`${failedToday} failed`}
        badgeTone="profit"
        icon={<CheckCircle2 className="w-4 h-4" aria-hidden />}
        loading={loading}
        onClick={() => router.push('/departments?tab=tasks')}
      />
      <KpiTile
        label="Cost MTD"
        value={formatCurrency(costMtd)}
        badge={costMtd != null ? 'this month' : 'loading\u2026'}
        badgeTone="warn"
        icon={<Wallet className="w-4 h-4" aria-hidden />}
        loading={loading}
        onClick={() => router.push('/finance')}
      />
      <KpiTile
        label="Pending Approvals"
        value={pendingApprovals}
        badge={pendingApprovals === 0 ? 'all clear' : 'requires attention'}
        badgeTone="risk"
        icon={<AlertCircle className="w-4 h-4" aria-hidden />}
        loading={loading}
        onClick={() => router.push('/service-desk?tab=approvals')}
      />
    </section>
  );
}

// ─── Internal tile ──────────────────────────────────────────────────────────

interface KpiTileProps {
  label: string;
  value: number | string;
  badge?: string;
  badgeTone: 'profit' | 'risk' | 'ops' | 'warn' | 'strategy';
  icon: React.ReactNode;
  loading?: boolean;
  onClick: () => void;
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
