'use client';
// ─── Project Detail (full page) ───────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import { ActionButton } from '@/components/creatio/ActionToolbar';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface ProjectDetail {
  id: string;
  name: string;
  description?: string;
  status: string;
  departmentId?: string;
  targetDate?: string;
  goalIds?: string[];
  createdAt: string;
  updatedAt: string;
}

export default function ProjectDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useTenantAuth();
  const [p, setP] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get(`/projects/${params.id}`)
      .then((r) => setP(unwrapItem(r)))
      .catch(() => setP(null))
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
  if (!p) {
    return (
      <TenantShell user={user}>
        <div className="max-w-5xl mx-auto card-surface p-12 text-center">
          <p className="text-zinc-300 font-medium">Project not found</p>
          <Link href="/departments" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium">
            <ArrowLeft className="w-3 h-3" /> Back to Departments
          </Link>
        </div>
      </TenantShell>
    );
  }

  const toggleStatus = async () => {
    await api.patch(`/projects/${p.id}`, { status: p.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE' });
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this project?')) return;
    await api.delete(`/projects/${p.id}`);
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
              <h1 className="text-2xl font-bold text-zinc-100 truncate">{p.name}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={p.status} />
                {p.targetDate && <span className="text-xs text-zinc-500">Due: {new Date(p.targetDate).toLocaleDateString()}</span>}
              </div>
              {p.description && <p className="text-sm text-zinc-400 mt-2">{p.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              <ActionButton variant="secondary" onClick={toggleStatus}>
                {p.status === 'ACTIVE' ? 'Archive' : 'Activate'}
              </ActionButton>
              <ActionButton variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={remove}>
                Delete
              </ActionButton>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Status" value={p.status} color={p.status === 'ACTIVE' ? 'profit' : 'warn'} />
          <KpiCard label="Target" value={p.targetDate ? new Date(p.targetDate).toLocaleDateString() : '—'} color="strategy" />
          <KpiCard label="Goals" value={p.goalIds?.length ?? 0} color="strategy" />
          <KpiCard label="Created" value={new Date(p.createdAt).toLocaleDateString()} color="neutral" />
        </section>

        {p.goalIds && p.goalIds.length > 0 && (
          <section className="card-surface p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3">Linked Goals</h2>
            <div className="flex flex-wrap gap-2">
              {p.goalIds.map((g) => (
                <Link key={g} href={`/goals/${g}`} className="text-xs px-3 py-1.5 rounded-md bg-surface text-zinc-300 border border-surface-border hover:bg-surface-overlay">
                  {g.slice(0, 8)}…
                </Link>
              ))}
            </div>
          </section>
        )}
      </div>
    </TenantShell>
  );
}