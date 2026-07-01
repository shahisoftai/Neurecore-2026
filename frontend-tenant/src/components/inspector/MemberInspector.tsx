'use client';
// ─── Member Inspector ────────────────────────────────────────────────────────
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { StatusBadge } from '@/components/creatio/StatusBadge';
import api from '@/services/api';
import { unwrapItem } from '@/services/unwrap';

interface MemberDetail {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role: string;
  isActive?: boolean;
  tenantId?: string | null;
  departmentId?: string | null;
  createdAt: string;
}

export function MemberInspector({ id }: { id: string }) {
  const [m, setM] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/users/tenant/${id}`)
      .then((r) => setM(unwrapItem(r)))
      .catch(() => setM(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-6 flex flex-col gap-4 animate-pulse">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-4 bg-surface-muted rounded" style={{ width: `${55 + i * 8}%` }} />
        ))}
      </div>
    );
  }
  if (!m) return <div className="p-6 text-zinc-500 text-sm">Member not found.</div>;

  const fullName = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-6 flex flex-col gap-5">
      <div>
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-lg font-bold text-zinc-100 leading-tight flex-1">{fullName}</h2>
          <Link
            href={`/users/${m.id}`}
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-muted text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Open full page"
            aria-label="Open full page"
          >
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">{m.email}</p>
        <div className="flex items-center gap-2 mt-2">
          <StatusBadge status={m.role} />
          {m.isActive !== undefined && (
            <StatusBadge status={m.isActive ? 'ACTIVE' : 'INACTIVE'} />
          )}
        </div>
      </div>

      <Row label="Member ID" value={m.id.slice(0, 8) + '…'} />
      <Row label="Joined" value={new Date(m.createdAt).toLocaleDateString()} />
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