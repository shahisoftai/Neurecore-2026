'use client';
// ─── Routine Detail (full page) ───────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Play, Pause, Trash2 } from 'lucide-react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface RoutineDetail {
  id: string;
  name: string;
  description?: string;
  status: string;
  graphDefinition?: {
    nodes?: Array<{ id: string; name: string; type: string }>;
    edges?: Array<{ source: string; target: string; label?: string }>;
  };
  config?: Record<string, unknown>;
  triggers?: Array<{ id: string; type: string; name?: string; config?: Record<string, unknown> }>;
  lastRunAt?: string | null;
  createdAt: string;
}

export default function RoutineDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useTenantAuth();
  const [r, setR] = useState<RoutineDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get(`/routines/${params.id}`)
      .then((res) => setR(unwrapItem(res)))
      .catch(() => setR(null))
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
  if (!r) {
    return (
      <TenantShell user={user}>
        <div className="max-w-5xl mx-auto card-surface p-12 text-center">
          <p className="text-zinc-300 font-medium">Routine not found</p>
          <Link href="/departments" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium">
            <ArrowLeft className="w-3 h-3" /> Back to Departments
          </Link>
        </div>
      </TenantShell>
    );
  }

  const setStatus = async (status: 'ACTIVE' | 'PAUSED' | 'DISABLED') => {
    await api.patch(`/routines/${r.id}`, { status });
    load();
  };
  const execute = async () => {
    await api.post(`/routines/${r.id}/execute`, {});
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this routine?')) return;
    await api.delete(`/routines/${r.id}`);
    router.push('/departments');
  };

  const nodes = r.graphDefinition?.nodes ?? [];
  const edges = r.graphDefinition?.edges ?? [];

  return (
    <TenantShell user={user}>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/departments" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="w-3 h-3" /> Departments
        </Link>

        <section className="card-surface p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-zinc-100 truncate">{r.name}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={r.status} />
                {r.lastRunAt && <span className="text-xs text-zinc-500">Last run: {new Date(r.lastRunAt).toLocaleString()}</span>}
              </div>
              {r.description && <p className="text-sm text-zinc-400 mt-2">{r.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {r.status === 'ACTIVE' ? (
                <ActionButton variant="secondary" icon={<Pause className="w-3.5 h-3.5" />} onClick={() => setStatus('PAUSED')}>Pause</ActionButton>
              ) : (
                <ActionButton variant="primary" icon={<Play className="w-3.5 h-3.5" />} onClick={() => setStatus('ACTIVE')}>Activate</ActionButton>
              )}
              <ActionButton variant="secondary" onClick={execute}>Run Now</ActionButton>
              <ActionButton variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={remove}>Delete</ActionButton>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Status" value={r.status} color={r.status === 'ACTIVE' ? 'profit' : 'warn'} />
          <KpiCard label="Nodes" value={nodes.length} color="ops" />
          <KpiCard label="Edges" value={edges.length} color="strategy" />
          <KpiCard label="Triggers" value={r.triggers?.length ?? 0} color="strategy" />
        </section>

        {nodes.length > 0 && (
          <section className="card-surface p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3">Graph</h2>
            <div className="space-y-2">
              {nodes.map((n) => (
                <div key={n.id} className="flex items-center justify-between text-sm px-3 py-2 rounded bg-surface border border-surface-border">
                  <span className="text-zinc-200">{n.name}</span>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{n.type}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {r.triggers && r.triggers.length > 0 && (
          <section className="card-surface p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3">Triggers</h2>
            <div className="space-y-2">
              {r.triggers.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm px-3 py-2 rounded bg-surface border border-surface-border">
                  <span className="text-zinc-200">{t.name ?? t.type}</span>
                  <span className="text-[10px] text-zinc-500 uppercase">{t.type}</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </TenantShell>
  );
}