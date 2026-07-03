'use client';

/**
 * /pool/packages — Industry × Tier matrix
 *
 * Top bar:     Industry dropdown + Tier list via /v1/tiers.
 * Grid cells:  Click to open drawer with multi-select pool agents.
 * Drawer:      Package metadata + entries editor (tick/untick, slot, budget).
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { poolService, type PoolAgent, type PoolDepartment } from '@/services/pool.service';
import { industryPackagesService, type Industry, type IndustryPackage, type IndustryPackageEntryPayload } from '@/services/industryPackages.service';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

interface TierInfo {
  id: string;
  name: string;
  slug: string;
  maxAgents: number;
  maxDepartments: number;
}

interface CellData {
  pkg: IndustryPackage | null;
  loading: boolean;
}

export default function PoolPackagesPage() {
  const user = useAdminAuth();
  const canWrite = user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_ADMIN';

  // Industries + tiers
  const [industries, setIndustries] = useState<Industry[]>([]);
  const [selectedIndustry, setSelectedIndustry] = useState<string>('');
  const [tiers, setTiers] = useState<TierInfo[]>([]);

  // Matrix cells
  const [cells, setCells] = useState<Record<string, CellData>>({});
  const [loadingMatrix, setLoadingMatrix] = useState(false);

  // Drawer
  const [drawerPkg, setDrawerPkg] = useState<IndustryPackage | null>(null);
  const [drawerLoading, setDrawerLoading] = useState(false);
  const [selectedEntries, setSelectedEntries] = useState<Record<string, IndustryPackageEntryPayload>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Agents catalog (for the multi-select)
  const [agentsCatalog, setAgentsCatalog] = useState<PoolAgent[]>([]);
  const [agentsDeptList, setAgentsDeptList] = useState<PoolDepartment[]>([]);
  const [agentsDropDiv, setAgentsDropDiv] = useState<string>('');

  // ─── Load industries + tiers ─────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [inds, tierRes] = await Promise.all([
          industryPackagesService.listIndustries(),
          api.get('/tiers'),
        ]);
        if (cancelled) return;
        setIndustries(inds);
        if (inds.length > 0) setSelectedIndustry(inds[0].value);
        const tierData = (unwrapList(tierRes).items ?? []) as TierInfo[];
        setTiers(tierData.filter((t) => t.slug !== 'free'));
      } catch { /* silently fallback */ }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Load matrix for selected industry ───────────────────────────

  const loadMatrix = useCallback(async () => {
    if (!selectedIndustry || tiers.length === 0) return;
    setLoadingMatrix(true);
    try {
      const all = await industryPackagesService.list({ industry: selectedIndustry });
      const byTier = new Map<string, IndustryPackage>();
      for (const p of all) byTier.set(p.tierId, p);
      const matrix: Record<string, CellData> = {};
      for (const t of tiers) {
        const p = byTier.get(t.id);
        matrix[cellKey(selectedIndustry, t.id)] = { pkg: p ?? null, loading: false };
      }
      setCells(matrix);
    } catch {
      setCells({});
    } finally {
      setLoadingMatrix(false);
    }
  }, [selectedIndustry, tiers]);

  useEffect(() => {
    void loadMatrix();
  }, [loadMatrix]);

  // ─── Drawer ──────────────────────────────────────────────────────

  const cellKey = (industry: string, tierId: string) => `${industry}::${tierId}`;

  const openDrawer = async (industry: string, tierId: string) => {
    const key = cellKey(industry, tierId);
    const cell = cells[key];
    setDrawerLoading(true);
    setSaveError(null);
    try {
      if (cell?.pkg) {
        const full = await industryPackagesService.getOne(cell.pkg.id);
        setDrawerPkg(full);
        const map: Record<string, IndustryPackageEntryPayload> = {};
        for (const e of full.entries) {
          map[e.poolAgentId] = {
            poolAgentId: e.poolAgentId,
            divisionSlug: e.divisionSlug,
            slot: e.slot,
            isRequired: e.isRequired,
            isDefaultSelected: e.isDefaultSelected,
            defaultBudgetPerDay: e.defaultBudgetPerDay ?? undefined,
            defaultModel: e.defaultModel ?? undefined,
          };
        }
        setSelectedEntries(map);
      } else {
        setDrawerPkg(null);
        setSelectedEntries({});
        // Create a bare package shell
        const tier = tiers.find((t) => t.id === tierId);
        const created = await industryPackagesService.create({
          industry,
          tierId,
          name: `${industry} • ${tier?.name ?? tierId}`,
          description: '',
        });
        setDrawerPkg(created);
        cells[key] = { pkg: created, loading: false };
        setCells({ ...cells });
      }

      // Pre-load agent catalog
      if (agentsCatalog.length === 0) {
        const [allDepts, allAgents] = await Promise.all([
          poolService.listDepartments(),
          poolService.listAgents({ limit: 300 }),
        ]);
        setAgentsDeptList(allDepts);
        setAgentsCatalog(allAgents.items);
      }
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to load package.');
    } finally {
      setDrawerLoading(false);
    }
  };

  const closeDrawer = () => {
    setDrawerPkg(null);
    setSelectedEntries({});
    setSaveError(null);
    void loadMatrix();
  };

  const toggleEntry = (agentId: string, divisionSlug: string) => {
    setSelectedEntries((prev) => {
      const next = { ...prev };
      if (next[agentId]) {
        delete next[agentId];
      } else {
        next[agentId] = {
          poolAgentId: agentId,
          divisionSlug,
          slot: Object.keys(next).length + 1,
          isRequired: true,
          isDefaultSelected: true,
          defaultBudgetPerDay: 5,
          defaultModel: 'gpt-4o-mini',
        };
      }
      return next;
    });
  };

  const handleSaveEntries = async () => {
    if (!drawerPkg) return;
    setSaving(true);
    setSaveError(null);
    try {
      const entries = Object.values(selectedEntries);
      const updated = await industryPackagesService.replaceEntries(drawerPkg.id, entries);
      setDrawerPkg(updated);
      const key = cellKey(updated.industry, updated.tierId);
      setCells((prev) => ({ ...prev, [key]: { pkg: updated, loading: false } }));
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save entries.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Pagination helper ───────────────────────────────────────────

  const visibleAgents = agentsCatalog.filter((a) => {
    if (agentsDropDiv && a.divisionSlug !== agentsDropDiv) return false;
    return true;
  });

  const groupedAgents = new Map<string, PoolAgent[]>();
  for (const a of visibleAgents) {
    const arr = groupedAgents.get(a.divisionSlug) ?? [];
    arr.push(a);
    groupedAgents.set(a.divisionSlug, arr);
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5 px-4 py-4">
        {/* ── Header ── */}
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Industry Packages</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Define which pool agents are deployed per (Industry × Tier). Click a cell to manage entries.
          </p>
        </div>

        {/* ── Industry selector ── */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-medium text-zinc-400">Industry:</label>
          <select
            value={selectedIndustry}
            onChange={(e) => setSelectedIndustry(e.target.value)}
            className="rounded-lg border border-surface-border bg-surface-overlay px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
          >
            {industries.map((ind) => (
              <option key={ind.value} value={ind.value}>{ind.label}</option>
            ))}
          </select>
        </div>

        {/* ── Matrix table ── */}
        {loadingMatrix ? (
          <div className="h-40 rounded-xl bg-surface-raised animate-pulse" />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-surface-border">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-raised/60">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400 w-10">#</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Tier</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Package</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Agents</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Required</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-zinc-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {tiers.map((t, idx) => {
                  const key = cellKey(selectedIndustry, t.id);
                  const cell = cells[key] ?? { pkg: null, loading: false };
                  return (
                    <tr
                      key={t.id}
                      onClick={() => canWrite ? void openDrawer(selectedIndustry, t.id) : null}
                      className={`border-t border-surface-border/50 transition ${
                        canWrite ? 'cursor-pointer hover:bg-surface-raised/40' : ''
                      }`}
                    >
                      <td className="px-4 py-2.5 text-zinc-600 text-xs">{idx + 1}</td>
                      <td className="px-4 py-2.5 font-medium text-zinc-200">{t.name}</td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        {cell.pkg ? cell.pkg.name : <span className="text-zinc-600 italic">— not set —</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        {cell.pkg ? `${cell.pkg.entryCount} / ${t.maxAgents} max` : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400">
                        {cell.pkg ? cell.pkg.requiredCount : <span className="text-zinc-600">—</span>}
                      </td>
                      <td className="px-4 py-2.5">
                        {cell.pkg ? (
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            cell.pkg.isRecommended
                              ? 'bg-amber-950 text-amber-400'
                              : cell.pkg.isActive
                                ? 'bg-emerald-950 text-emerald-400'
                                : 'bg-zinc-800 text-zinc-500'
                          }`}>
                            {cell.pkg.isRecommended ? 'Recommended' : cell.pkg.isActive ? 'Active' : 'Inactive'}
                          </span>
                        ) : (
                          canWrite ? (
                            <span className="text-xs text-indigo-400">Click to create</span>
                          ) : (
                            <span className="text-xs text-zinc-700">—</span>
                          )
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Drawer ── */}
        <AnimatePresence>
          {(drawerPkg || drawerLoading) && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
                onClick={closeDrawer}
              />
              <motion.aside
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="fixed right-0 top-0 bottom-0 z-50 w-[480px] max-w-[95vw] bg-surface-raised border-l border-surface-border shadow-2xl flex flex-col"
              >
                {drawerLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="h-40 w-40 rounded-xl bg-surface-raised animate-pulse" />
                  </div>
                ) : drawerPkg ? (
                  <>
                    {/* Header */}
                    <div className="px-5 py-4 border-b border-surface-border shrink-0">
                      <div className="flex items-center justify-between">
                        <div>
                          <h2 className="text-base font-semibold text-zinc-100">{drawerPkg.name}</h2>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {drawerPkg.industry} · {drawerPkg.tierName} ({drawerPkg.tierSlug})
                          </p>
                        </div>
                        <button
                          onClick={closeDrawer}
                          className="p-1.5 rounded-lg hover:bg-surface-overlay text-zinc-500 hover:text-zinc-200 transition"
                        >
                          ✕
                        </button>
                      </div>
                      {saveError && (
                        <div className="mt-2 rounded-lg bg-red-950/40 border border-red-800 px-3 py-1.5 text-xs text-red-300">{saveError}</div>
                      )}
                    </div>

                    {/* Body */}
                    <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
                      {/* Package metadata */}
                      {canWrite && (
                        <div className="space-y-2">
                          <input
                            value={drawerPkg.name}
                            onChange={(e) => setDrawerPkg((p) => p ? { ...p, name: e.target.value } : null)}
                            className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                          />
                          <div className="flex gap-3 items-center">
                            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <input
                                type="checkbox"
                                checked={drawerPkg.isActive}
                                onChange={(e) => setDrawerPkg((p) => p ? { ...p, isActive: e.target.checked } : null)}
                                className="rounded border-surface-border"
                              />
                              Active
                            </label>
                            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                              <input
                                type="checkbox"
                                checked={drawerPkg.isRecommended}
                                onChange={(e) => setDrawerPkg((p) => p ? { ...p, isRecommended: e.target.checked } : null)}
                                className="rounded border-surface-border"
                              />
                              Recommended
                            </label>
                          </div>
                        </div>
                      )}

                      {/* Division filter */}
                      <div>
                        <label className="text-xs font-medium text-zinc-400">Filter division:</label>
                        <select
                          value={agentsDropDiv}
                          onChange={(e) => setAgentsDropDiv(e.target.value)}
                          className="ml-2 rounded-lg border border-surface-border bg-surface-overlay px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                        >
                          <option value="">All</option>
                          {agentsDeptList.map((d) => (
                            <option key={d.id} value={d.slug}>{d.name}</option>
                          ))}
                        </select>
                      </div>

                      {/* Agent multi-select grouped by division */}
                      <div className="space-y-3">
                        {Array.from(groupedAgents.entries()).map(([divSlug, agents]) => {
                          const dept = agentsDeptList.find((d) => d.slug === divSlug);
                          return (
                            <div key={divSlug}>
                              <h3 className="text-xs font-semibold text-zinc-500 mb-1.5 flex items-center gap-1">
                                <span>{dept?.icon ?? '◆'}</span>
                                <span>{dept?.name ?? divSlug}</span>
                                <span className="text-zinc-700">({agents.length})</span>
                              </h3>
                              <div className="space-y-1">
                                {agents.map((a) => {
                                  const selected = !!selectedEntries[a.id];
                                  return (
                                    <label
                                      key={a.id}
                                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer transition text-sm ${
                                        selected
                                          ? 'border-indigo-600/40 bg-indigo-950/20 text-zinc-100'
                                          : 'border-surface-border bg-surface-overlay text-zinc-400 hover:text-zinc-200'
                                      }`}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={selected}
                                        onChange={() => toggleEntry(a.id, a.divisionSlug)}
                                        className="rounded border-surface-border shrink-0"
                                      />
                                      <span className="flex-1 truncate">{a.emoji ?? '🤖'} {a.name}</span>
                                      <span className="text-xs text-zinc-600">{a.division}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                        {visibleAgents.length === 0 && (
                          <p className="text-sm text-zinc-600 py-8 text-center">No agents match the filter.</p>
                        )}
                      </div>
                    </div>

                    {/* Footer */}
                    {canWrite && (
                      <div className="px-5 py-3 border-t border-surface-border shrink-0 flex justify-between items-center gap-3">
                        <div className="text-xs text-zinc-500">
                          {Object.keys(selectedEntries).length} selected
                          {(() => {
                            const requiredCount = Object.values(selectedEntries).filter((e) => e.isRequired).length;
                            return ` · ${requiredCount} required`;
                          })()}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={closeDrawer}
                            className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 transition"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void handleSaveEntries()}
                            disabled={saving}
                            className="px-4 py-1.5 rounded-lg text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Entries'}
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                ) : null}
              </motion.aside>
            </>
          )}
        </AnimatePresence>
      </div>
    </AdminShell>
  );
}
