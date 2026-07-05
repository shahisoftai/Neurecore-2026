"use client";

/**
 * /feature-flags — Phase Hermes H9: per-tenant feature flag toggle.
 *
 * Platform admins can override any tenant's runtime feature flags.
 * Each toggle PATCHes `/api/v1/feature-flags/tenants/:tenantId` and
 * invalidates the in-process cache.
 *
 * Tenants picker: minimal — uses `tenantsService.list()` from existing
 * admin service. Replace with a proper typeahead search once the
 * tenant catalog grows.
 */

import { useCallback, useEffect, useState } from 'react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import {
  getTenantFeatureFlags,
  updateTenantFeatureFlags,
  type TenantFeatureFlagOverrides,
} from '@/services/adminFeatureFlags.service';

const FLAG_LABELS: Array<{
  key: keyof TenantFeatureFlagOverrides;
  label: string;
  description: string;
}> = [
  {
    key: 'HERMES_ENABLED',
    label: 'Hermes runtime',
    description:
      'Route all agent executions through the new Hermes runtime (LangGraph-based) instead of the legacy agent state machine.',
  },
  {
    key: 'HERMES_AUTO_LINK',
    label: 'Hermes auto-link',
    description:
      'On first execution of any agent, auto-create a matching HermesAgent record.',
  },
  {
    key: 'HERMES_APPROVAL_REQUIRED',
    label: 'Hermes approval required',
    description:
      'Require explicit human approval before any tool call. Pairs with the ApprovalWorkflowEngine.',
  },
  {
    key: 'HERMES_SESSION_LOGGING',
    label: 'Hermes session logging',
    description:
      'Persist every Hermes session to HermesSession table for replay & audit. Disable for high-volume tenants.',
  },
  {
    key: 'DISABLE_AI_ACTIONS',
    label: 'AI actions kill-switch',
    description:
      'Emergency stop — blocks ALL AI actions for this tenant. Independent of Hermes flag.',
  },
];

interface TenantOption {
  id: string;
  name: string;
}

async function fetchTenants(): Promise<TenantOption[]> {
  const res = await api.get('/tenants', { params: { limit: 200 } });
  const data = (res.data?.data ?? res.data) as {
    items?: Array<{ id: string; name: string }>;
  };
  return (data.items ?? []).map((t) => ({ id: t.id, name: t.name }));
}

export default function FeatureFlagsAdminPage() {
  const user = useAdminAuth();
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [overrides, setOverrides] = useState<TenantFeatureFlagOverrides>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchTenants()
      .then((list) => {
        if (!cancelled) setTenants(list);
      })
      .catch(() => {
        if (!cancelled) setTenants([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadOverrides = useCallback(async (tenantId: string) => {
    if (!tenantId) {
      setOverrides({});
      return;
    }
    try {
      const next = await getTenantFeatureFlags(tenantId);
      setOverrides(next);
    } catch {
      setOverrides({});
    }
  }, []);

  useEffect(() => {
    void loadOverrides(selectedId);
  }, [selectedId, loadOverrides]);

  async function toggle(
    key: keyof TenantFeatureFlagOverrides,
    value: boolean,
  ) {
    if (!selectedId) return;
    setSavingKey(key);
    setStatusMessage(null);
    try {
      const next = await updateTenantFeatureFlags(selectedId, {
        ...overrides,
        [key]: value,
      });
      setOverrides(next);
      setStatusMessage(`Saved ${key}=${value}`);
    } catch (err) {
      setStatusMessage(
        `Save failed: ${err instanceof Error ? err.message : 'unknown'}`,
      );
    } finally {
      setSavingKey(null);
    }
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-3xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">
            Feature flags
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Override runtime feature flags per tenant. Global defaults live in
            the backend <code>.env</code> file.
          </p>
        </div>

        <section className="rounded-xl border border-surface-border bg-surface-raised p-5 space-y-4">
          <div>
            <label className="text-xs text-zinc-400 mb-1 block">Tenant</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
            >
              <option value="">— Select a tenant —</option>
              {tenants.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          {!selectedId && (
            <p className="text-xs text-zinc-500">
              Pick a tenant to view and edit its feature-flag overrides.
            </p>
          )}
        </section>

        {selectedId && (
          <section className="rounded-xl border border-surface-border bg-surface-raised divide-y divide-surface-border">
            {FLAG_LABELS.map((flag) => {
              const v = overrides[flag.key];
              return (
                <div
                  key={flag.key}
                  className="p-4 flex items-start justify-between gap-4"
                >
                  <div>
                    <div className="text-sm font-medium text-zinc-100">
                      {flag.label}
                    </div>
                    <div className="text-xs text-zinc-500 mt-1 max-w-xl">
                      {flag.description}
                    </div>
                    <div className="text-[10px] text-zinc-600 mt-2 font-mono">
                      {flag.key}
                      {typeof v === 'boolean'
                        ? ` = ${v}`
                        : ' (inherits global default)'}
                    </div>
                  </div>
                  <button
                    onClick={() => toggle(flag.key, !v)}
                    disabled={savingKey === flag.key}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      v === true
                        ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300'
                        : v === false
                          ? 'bg-rose-600/20 border-rose-500 text-rose-300'
                          : 'border-surface-border text-zinc-400 hover:text-zinc-200'
                    } ${savingKey === flag.key ? 'opacity-50' : ''}`}
                  >
                    {savingKey === flag.key
                      ? 'Saving…'
                      : v === true
                        ? 'On'
                        : v === false
                          ? 'Off'
                          : 'Inherit'}
                  </button>
                </div>
              );
            })}
          </section>
        )}

        {statusMessage && (
          <div className="text-xs text-zinc-400">{statusMessage}</div>
        )}
      </div>
    </AdminShell>
  );
}