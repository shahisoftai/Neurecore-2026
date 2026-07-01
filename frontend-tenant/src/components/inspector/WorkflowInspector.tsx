'use client';
// ─── Workflow Inspector ───────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink, Play, Pause, Trash2 } from 'lucide-react';
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

export function WorkflowInspector({ id }: { id: string }) {
  const [wf, setWf] = useState<WorkflowDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get(`/workflows/${id}`)
      .then((r) => setWf(unwrapItem(r)))
      .catch(() => setWf(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const activate = async () => {
    await api.post(`/workflows/${id}/activate`);
    load();
  };
  const execute = async () => {
    await api.post(`/workflows/${id}/execute`);
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this workflow?')) return;
    await api.delete(`/workflows/${id}`);
    load();
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 bg-surface-muted rounded" style={{ width: `${55 + i * 8}%` }} />
        ))}
      </div>
    );
  }
  if (!wf) return <div className="p-6 text-zinc-500 text-sm">Workflow not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-100 leading-tight flex-1">{wf.name}</h2>
          <Link
            href={`/workflows/${wf.id}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open full page"
            aria-label="Open full page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={wf.isActive ? 'ACTIVE' : wf.status ?? 'DRAFT'} />
          {wf.isTemplate && <StatusBadge status="TEMPLATE" />}
          {wf.agent && <span className="text-xs text-zinc-500">Agent: {wf.agent.name}</span>}
        </div>
        {wf.description && <p className="text-xs text-zinc-400 mt-2">{wf.description}</p>}
      </div>

      <Row label="Created" value={new Date(wf.createdAt).toLocaleString()} />
      <Row label="Updated" value={new Date(wf.updatedAt).toLocaleString()} />

      {wf.definition && Object.keys(wf.definition).length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-1">Definition</p>
          <pre className="text-[10px] text-zinc-300 font-mono bg-surface p-3 rounded-lg border border-surface-border overflow-auto max-h-48">
            {JSON.stringify(wf.definition, null, 2)}
          </pre>
        </div>
      )}

      <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
        {wf.isActive ? (
          <ActionButton variant="secondary" size="md" icon={<Pause className="w-3.5 h-3.5" />} onClick={activate}>
            Pause
          </ActionButton>
        ) : (
          <ActionButton variant="primary" size="md" icon={<Play className="w-3.5 h-3.5" />} onClick={activate}>
            Activate
          </ActionButton>
        )}
        <ActionButton variant="secondary" size="md" onClick={execute}>
          Execute Now
        </ActionButton>
        <ActionButton
          variant="danger"
          size="md"
          icon={<Trash2 className="w-3.5 h-3.5" />}
          onClick={remove}
        >
          Delete
        </ActionButton>
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs text-zinc-500">{label}</span>
      <span className="text-xs text-zinc-300 font-medium">{value}</span>
    </div>
  );
}