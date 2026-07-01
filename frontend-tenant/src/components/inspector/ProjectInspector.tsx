'use client';
// ─── Project Inspector ────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink, Trash2 } from 'lucide-react';
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

export function ProjectInspector({ id }: { id: string }) {
  const [p, setP] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api
      .get(`/projects/${id}`)
      .then((r) => setP(unwrapItem(r)))
      .catch(() => setP(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateStatus = async (status: string) => {
    await api.patch(`/projects/${id}`, { status });
    load();
  };
  const remove = async () => {
    if (!confirm('Delete this project?')) return;
    await api.delete(`/projects/${id}`);
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
  if (!p) return <div className="p-6 text-zinc-500 text-sm">Project not found.</div>;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-100 leading-tight flex-1">{p.name}</h2>
          <Link
            href={`/projects/${p.id}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open full page"
            aria-label="Open full page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={p.status} />
          {p.targetDate && (
            <span className="text-xs text-zinc-500">
              Due: {new Date(p.targetDate).toLocaleDateString()}
            </span>
          )}
        </div>
        {p.description && <p className="text-xs text-zinc-400 mt-2">{p.description}</p>}
      </div>

      {p.goalIds && p.goalIds.length > 0 && (
        <div>
          <p className="text-xs text-zinc-500 mb-2">Linked Goals</p>
          <div className="flex flex-wrap gap-1.5">
            {p.goalIds.map((g) => (
              <Link
                key={g}
                href={`/goals/${g}`}
                className="text-xs px-2 py-1 rounded bg-surface text-zinc-300 border border-surface-border hover:bg-surface-overlay"
              >
                {g.slice(0, 8)}…
              </Link>
            ))}
          </div>
        </div>
      )}

      <Row label="Created" value={new Date(p.createdAt).toLocaleString()} />

      <div className="flex flex-col gap-2 pt-2 border-t border-surface-border">
        <ActionButton
          variant="secondary"
          size="md"
          onClick={() => updateStatus(p.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE')}
        >
          {p.status === 'ACTIVE' ? 'Archive' : 'Activate'}
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