'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';
import type { ApiResponse, PaginatedData, Tenant } from '@/types/api.types';

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: 'bg-green-900 text-green-300',
  SUSPENDED: 'bg-yellow-900 text-yellow-300',
  CANCELLED: 'bg-red-900 text-red-300',
  TRIAL: 'bg-blue-900 text-blue-300',
};

export default function TenantsPage() {
  const user = useAdminAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/tenants', { params: { page, limit, search: search || undefined } });
      setTenants(unwrapList(res).items);
      setTotal(unwrapList(res).total ?? 0);
    } catch {
      setError('Failed to load tenants');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { void load(); }, [load]);

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Tenants</h1>
        <span className="text-sm text-gray-400">{total} total</span>
      </div>

      <div className="mb-4">
        <input
          type="search"
          placeholder="Search tenants…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          className="w-full max-w-sm rounded-lg border border-gray-700 bg-gray-900 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {error && <div className="mb-4 rounded-lg bg-red-950 border border-red-800 p-3 text-sm text-red-300">{error}</div>}

      <div className="rounded-xl border border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-900 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left">Name</th>
              <th className="px-4 py-3 text-left">Slug</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Agent Limit</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">Loading…</td></tr>
            ) : tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No tenants found</td></tr>
            ) : tenants.map((t) => (
              <tr key={t.id} className="hover:bg-gray-900 transition">
                <td className="px-4 py-3 font-medium">{t.name}</td>
                <td className="px-4 py-3 text-gray-400">{t.slug}</td>
                <td className="px-4 py-3">{t.plan}</td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-800 text-gray-300'}`}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-3">{t.agentLimit}</td>
                <td className="px-4 py-3 text-gray-400">{new Date(t.createdAt).toLocaleDateString()}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/tenants/${t.id}`} className="text-xs text-indigo-400 hover:text-indigo-300 hover:underline transition">View →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {total > limit && (
        <div className="mt-4 flex items-center gap-2 justify-end">
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
            className="rounded px-3 py-1.5 text-sm border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition">
            Previous
          </button>
          <span className="text-sm text-gray-400">Page {page} of {Math.ceil(total / limit)}</span>
          <button onClick={() => setPage((p) => p + 1)} disabled={page * limit >= total}
            className="rounded px-3 py-1.5 text-sm border border-gray-700 disabled:opacity-40 hover:bg-gray-800 transition">
            Next
          </button>
        </div>
      )}
    </AdminShell>
  );
}
