'use client';
// ─── User/Member Detail (full page) ───────────────────────────────────────────
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useTenantAuth } from '@/hooks/useTenantAuth';
import TenantShell from '@/components/TenantShell';
import { KpiCard } from '@/components/creatio/KpiCard';
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

export default function MemberDetailPage() {
  const params = useParams<{ id: string }>();
  const user = useTenantAuth();
  const [m, setM] = useState<MemberDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api
      .get(`/users/tenant/${params.id}`)
      .then((r) => setM(unwrapItem(r)))
      .catch(() => setM(null))
      .finally(() => setLoading(false));
  }, [params.id]);

  if (!user) return null;
  if (loading) {
    return (
      <TenantShell user={user}>
        <div className="max-w-5xl mx-auto p-6 text-zinc-500 text-sm">Loading…</div>
      </TenantShell>
    );
  }
  if (!m) {
    return (
      <TenantShell user={user}>
        <div className="max-w-5xl mx-auto card-surface p-12 text-center">
          <p className="text-zinc-300 font-medium">Member not found</p>
          <Link href="/departments" className="inline-flex items-center gap-2 mt-4 px-4 py-2 rounded-lg bg-accent-500 hover:bg-accent-600 text-white text-xs font-medium">
            <ArrowLeft className="w-3 h-3" /> Back to Departments
          </Link>
        </div>
      </TenantShell>
    );
  }

  const fullName = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;

  return (
    <TenantShell user={user}>
      <div className="max-w-5xl mx-auto space-y-6">
        <Link href="/departments" className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300">
          <ArrowLeft className="w-3 h-3" /> Departments
        </Link>

        <section className="card-surface p-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-accent-500/15 text-accent-500 flex items-center justify-center text-2xl font-semibold shrink-0">
              {(m.firstName?.[0] ?? m.email[0]).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-zinc-100 truncate">{fullName}</h1>
              <p className="text-sm text-zinc-500 truncate">{m.email}</p>
              <div className="flex items-center gap-2 mt-2">
                <StatusBadge status={m.role} />
                {m.isActive !== undefined && <StatusBadge status={m.isActive ? 'ACTIVE' : 'INACTIVE'} />}
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Role" value={m.role} color="strategy" />
          <KpiCard label="Status" value={m.isActive ? 'Active' : 'Inactive'} color={m.isActive ? 'profit' : 'warn'} />
          <KpiCard label="Joined" value={new Date(m.createdAt).toLocaleDateString()} color="neutral" />
          <KpiCard label="Department" value={m.departmentId ? m.departmentId.slice(0, 8) + '…' : '—'} color="strategy" />
        </section>
      </div>
    </TenantShell>
  );
}