'use client';
// ─── Goal Detail (full page) ──────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Minus, Trash2 } from 'lucide-react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface GoalDetail {
  id: string;
  title: string;
  description?: string;
  status: string;
  level: string;
  progress: number;
  parentId?: string | null;
  ownerAgentId?: string | null;
  ownerAgent?: { name: string };
  departmentId?: string;
  targetDate?: string;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function GoalDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useTenantAuth();
  const [g, setG] = useState<GoalDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get(`/goals/${params.id}`)
      .then((r) => setG(unwrapItem(r)))
      .catch(() => setG(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  if (!user) return null;
  if (loading) {
    return (
      <TenantShell user={user}>
        <div className="max-w-5xl mx-auto p-6 text-zinc-500 text-sm">Loading…</div>
      </TenantShell>
    );
  }
  if (!g) {
    return (
      <TenantShell user={user}>
        <div className="max-w-5xl mx-auto card-surface p-12 text-center">
          <p className="text-zinc-300 font-medium">Goal not found</p>
          <Link href="/departments" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium">
            <ArrowLeft className="w-3 h-3" /> Back to Departments
          </Link>
        </div>
      </TenantShell>
    );
  }

  const adjustProgress = async (delta: number) => {
    const next = Math.max(0, Math.min(100, g.progress + delta));
    await api.patch(`/goals/${g.id}/progress`, { progress: next });
    load();
  };
  const setStatus = async (status: string) => {
    await api.patch(`/goals/${g.id}`, { status });
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this goal?')) return;
    await api.delete(`/goals/${g.id}`);
    router.push('/departments');
  };

  return (
    <TenantShell user={user}>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/departments" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="w-3 h-3" /> Departments
        </Link>

        <section className="card-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-zinc-100">{g.title}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={g.status} />
                <StatusBadge status={g.level} />
                {g.ownerAgent?.name && <span className="text-xs text-zinc-500">Owner: {g.ownerAgent.name}</span>}
              </div>
              {g.description && <p className="text-sm text-zinc-400 mt-2">{g.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {g.status === 'COMPLETED' ? (
                <ActionButton variant="secondary" onClick={() => setStatus('ACTIVE')}>Reopen</ActionButton>
              ) : (
                <ActionButton variant="primary" onClick={() => setStatus('COMPLETED')}>Mark Complete</ActionButton>
              )}
              <ActionButton variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={remove}>Delete</ActionButton>
            </div>
          </div>
        </section>

        <section className="card-surface p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-zinc-200">Progress</h2>
            <span className="text-sm font-mono text-zinc-300">{g.progress}%</span>
          </div>
          <div className="w-full h-3 bg-surface-muted rounded-full overflow-hidden">
            <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${g.progress}%` }} />
          </div>
          <div className="flex items-center gap-2 mt-3">
            <ActionButton variant="secondary" size="sm" icon={<Minus className="w-3 h-3" />} onClick={() => adjustProgress(-10)}>-10</ActionButton>
            <ActionButton variant="secondary" size="sm" icon={<Plus className="w-3 h-3" />} onClick={() => adjustProgress(10)}>+10</ActionButton>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Level" value={g.level} color="strategy" />
          <KpiCard label="Status" value={g.status} color={g.status === 'COMPLETED' ? 'profit' : 'warn'} />
          <KpiCard label="Target" value={g.targetDate ? new Date(g.targetDate).toLocaleDateString() : '—'} color="strategy" />
          <KpiCard label="Created" value={new Date(g.createdAt).toLocaleDateString()} color="neutral" />
        </section>
      </div>
    </TenantShell>
  );
}