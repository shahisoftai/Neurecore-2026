'use client';
// ─── Workflow Detail (full page) ─────────────────────────────────────────────
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

interface WorkflowDetail {
  id: string;
  name: string;
  description?: string;
  status?: string;
  isActive?: boolean;
  isTemplate?: boolean;
  definition?: Record<string, unknown>;
  config?: Record<string, unknown>;
  agent?: { id: string; name: string };
  createdAt: string;
  updatedAt: string;
}

export default function WorkflowDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const user = useTenantAuth();
  const [wf, setWf] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get(`/workflows/${params.id}`)
      .then((r) => setWf(unwrapItem(r)))
      .catch(() => setWf(null))
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
  if (!wf) {
    return (
      <TenantShell user={user}>
        <div className="max-w-5xl mx-auto card-surface p-12 text-center">
          <p className="text-zinc-300 font-medium">Workflow not found</p>
          <Link href="/departments" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium">
            <ArrowLeft className="w-3 h-3" /> Back to Departments
          </Link>
        </div>
      </TenantShell>
    );
  }

  const toggleActive = async () => {
    await api.post(`/workflows/${wf.id}/activate`);
    load();
  };
  const execute = async () => {
    await api.post(`/workflows/${wf.id}/execute`);
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this workflow?')) return;
    await api.delete(`/workflows/${wf.id}`);
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
              <h1 className="text-2xl font-bold text-zinc-100 truncate">{wf.name}</h1>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <StatusBadge status={wf.isActive ? 'ACTIVE' : wf.status ?? 'DRAFT'} />
                {wf.isTemplate && <StatusBadge status="TEMPLATE" />}
                {wf.agent && <span className="text-xs text-zinc-500">Agent: {wf.agent.name}</span>}
              </div>
              {wf.description && <p className="text-sm text-zinc-400 mt-2">{wf.description}</p>}
            </div>
            <div className="flex items-center gap-2">
              {wf.isActive ? (
                <ActionButton variant="secondary" icon={<Pause className="w-3.5 h-3.5" />} onClick={toggleActive}>
                  Pause
                </ActionButton>
              ) : (
                <ActionButton variant="primary" icon={<Play className="w-3.5 h-3.5" />} onClick={toggleActive}>
                  Activate
                </ActionButton>
              )}
              <ActionButton variant="secondary" onClick={execute}>Execute</ActionButton>
              <ActionButton variant="danger" icon={<Trash2 className="w-3.5 h-3.5" />} onClick={remove}>
                Delete
              </ActionButton>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Status" value={wf.isActive ? 'Active' : 'Inactive'} color={wf.isActive ? 'profit' : 'warn'} />
          <KpiCard label="Agent" value={wf.agent?.name ?? '—'} color="ops" />
          <KpiCard label="Created" value={new Date(wf.createdAt).toLocaleDateString()} color="neutral" />
          <KpiCard label="Updated" value={new Date(wf.updatedAt).toLocaleDateString()} color="neutral" />
        </section>

        {wf.definition && Object.keys(wf.definition).length > 0 && (
          <section className="card-surface p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3">Definition</h2>
            <pre className="text-xs text-zinc-300 font-mono bg-surface p-4 rounded-lg border border-surface-border overflow-auto max-h-96">
              {JSON.stringify(wf.definition, null, 2)}
            </pre>
          </section>
        )}
        {wf.config && Object.keys(wf.config).length > 0 && (
          <section className="card-surface p-6">
            <h2 className="text-sm font-semibold text-zinc-200 mb-3">Config</h2>
            <pre className="text-xs text-zinc-300 font-mono bg-surface p-4 rounded-lg border border-surface-border overflow-auto">
              {JSON.stringify(wf.config, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </TenantShell>
  );
}