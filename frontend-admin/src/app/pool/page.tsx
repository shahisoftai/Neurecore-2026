'use client';

/**
 * /pool — Pool Catalog
 *
 * Left pane:  PoolDepartment list with agentCounts (click to select).
 * Right pane: Paginated PoolAgent table filtered by selected division.
 *
 * SUPER_ADMIN + PLATFORM_ADMIN: read + write (create/edit/delete agents).
 * SECURITY_OFFICER + SUPPORT: read-only view.
 */

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { poolService, type PoolDepartment, type PoolAgent, type CreatePoolAgentPayload } from '@/services/pool.service';

const LIMIT = 15;

const EMPTY_FORM: CreatePoolAgentPayload = {
  name: '',
  division: '',
  divisionSlug: '',
  description: '',
  category: '',
  systemPrompt: '',
  version: '1.0.0',
};

export default function PoolCatalogPage() {
  const user = useAdminAuth();

  // Departments (left pane)
  const [departments, setDepartments] = useState<PoolDepartment[]>([]);
  const [deptsLoading, setDeptsLoading] = useState(true);
  const [selectedDept, setSelectedDept] = useState<PoolDepartment | null>(null);

  // Agents (right pane)
  const [agents, setAgents] = useState<PoolAgent[]>([]);
  const [agentsTotal, setAgentsTotal] = useState(0);
  const [agentsPage, setAgentsPage] = useState(1);
  const [agentsLoading, setAgentsLoading] = useState(false);
  const [search, setSearch] = useState('');

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PoolAgent | null>(null);
  const [form, setForm] = useState<CreatePoolAgentPayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<PoolAgent | null>(null);

  const canWrite = user?.role === 'SUPER_ADMIN' || user?.role === 'PLATFORM_ADMIN';

  // ─── Load departments ──────────────────────────────────────────────

  const loadDepts = useCallback(async () => {
    setDeptsLoading(true);
    try {
      const list = await poolService.listDepartments();
      setDepartments(list);
      if (!selectedDept && list.length > 0) setSelectedDept(list[0]);
    } catch {
      setDepartments([]);
    } finally {
      setDeptsLoading(false);
    }
  }, [selectedDept]);

  // ─── Load agents ──────────────────────────────────────────────────

  const loadAgents = useCallback(async () => {
    if (!selectedDept) return;
    setAgentsLoading(true);
    try {
      const res = await poolService.listAgents({
        divisionSlug: selectedDept.slug,
        q: search || undefined,
        page: agentsPage,
        limit: LIMIT,
      });
      setAgents(res.items);
      setAgentsTotal(res.total);
    } catch {
      setAgents([]);
      setAgentsTotal(0);
    } finally {
      setAgentsLoading(false);
    }
  }, [selectedDept, search, agentsPage]);

  useEffect(() => {
    void loadDepts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void loadAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDept, search, agentsPage]);

  // ─── Department click ─────────────────────────────────────────────

  const handleSelectDept = (d: PoolDepartment) => {
    setSelectedDept(d);
    setAgentsPage(1);
    setSearch('');
  };

  // ─── Modal ────────────────────────────────────────────────────────

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (a: PoolAgent) => {
    setEditing(a);
    setForm({
      name: a.name,
      division: a.division,
      divisionSlug: a.divisionSlug,
      description: a.description ?? '',
      category: a.category ?? '',
      emoji: a.emoji ?? '',
      color: a.color ?? '',
      systemPrompt: a.systemPrompt,
      version: a.version,
    });
    setSaveError(null);
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim() || !form.division.trim() || !form.divisionSlug.trim()) {
      setSaveError('Name, Division, and Division Slug are required.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      if (editing) {
        await poolService.updateAgent(editing.id, form);
      } else {
        await poolService.createAgent(form);
      }
      setModalOpen(false);
      void loadAgents();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed.');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setSaving(true);
    try {
      await poolService.removeAgent(deleteTarget.id);
      setDeleteTarget(null);
      void loadAgents();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Delete failed.');
    } finally {
      setSaving(false);
    }
  };

  // ─── Pagination ───────────────────────────────────────────────────

  const totalPages = Math.max(1, Math.ceil(agentsTotal / LIMIT));

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="flex h-full max-h-[calc(100vh-80px)] overflow-hidden">

        {/* ── Left pane — departments ── */}
        <aside className="w-64 shrink-0 border-r border-surface-border flex flex-col">
          <div className="px-4 py-3 border-b border-surface-border">
            <h2 className="text-sm font-semibold text-zinc-200">Divisions</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{departments.length} total</p>
          </div>
          <div className="flex-1 overflow-y-auto py-1">
            {deptsLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-10 mx-3 my-1 rounded-lg bg-surface-raised animate-pulse" />
              ))
            ) : (
              departments.map((d) => (
                <button
                  key={d.id}
                  onClick={() => handleSelectDept(d)}
                  className={`w-full text-left px-4 py-2.5 flex items-center gap-2.5 transition text-sm ${
                    selectedDept?.id === d.id
                      ? 'bg-indigo-950/40 border-l-2 border-indigo-500 text-zinc-100'
                      : 'hover:bg-surface-raised text-zinc-400 border-l-2 border-transparent'
                  }`}
                >
                  <span className="text-base">{d.icon ? d.icon.charAt(0).toUpperCase() : '◆'}</span>
                  <span className="flex-1 truncate">{d.name}</span>
                  <span className="text-xs text-zinc-600">{d.agentCount}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        {/* ── Right pane — agent table ── */}

        <main className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-6 py-3 border-b border-surface-border flex items-center justify-between shrink-0">
            <div>
              <h1 className="text-base font-semibold text-zinc-100">
                {selectedDept ? `${selectedDept.name} Agents` : 'Pool Catalog'}
              </h1>
              {selectedDept && (
                <p className="text-xs text-zinc-500 mt-0.5">
                  {selectedDept.description ?? `${selectedDept.agentCount} agents in this division`}
                </p>
              )}
            </div>
            {canWrite && (
              <button
                onClick={openCreate}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium transition"
              >
                + New Agent
              </button>
            )}
          </div>

          {/* Toolbar */}
          <div className="px-6 py-2 border-b border-surface-border/50 shrink-0 flex items-center gap-3">
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setAgentsPage(1); }}
              placeholder="Search agents..."
              className="flex-1 max-w-xs rounded-lg border border-surface-border bg-surface-overlay px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
            />
            <span className="text-xs text-zinc-600 ml-auto">{agentsTotal} agents</span>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-y-auto px-6 py-3">
            {agentsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-12 rounded-lg bg-surface-raised animate-pulse" />
                ))}
              </div>
            ) : agents.length === 0 ? (
              <div className="py-16 text-center text-zinc-500 text-sm">No agents found.</div>
            ) : (
              <div className="space-y-1.5">
                {agents.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-lg border border-surface-border bg-surface-raised px-4 py-3 flex items-center gap-3 hover:border-indigo-700/30 transition"
                  >
                    <span className="text-lg shrink-0">{a.emoji ?? '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-zinc-100 truncate">{a.name}</div>
                      <div className="text-xs text-zinc-500 truncate">{a.description ?? 'No description'}</div>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      a.isActive ? 'bg-emerald-950 text-emerald-400' : 'bg-zinc-800 text-zinc-500'
                    }`}>
                      {a.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-zinc-600">{a.packageEntryCount} pkgs</span>
                    {canWrite && (
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => openEdit(a)}
                          className="px-2 py-1 rounded text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-indigo-500 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(a)}
                          className="px-2 py-1 rounded text-xs border border-surface-border text-zinc-600 hover:text-red-400 hover:border-red-700 transition"
                        >
                          Del
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-6 py-2 border-t border-surface-border/50 flex items-center justify-center gap-2">
              <button
                onClick={() => setAgentsPage((p) => Math.max(1, p - 1))}
                disabled={agentsPage <= 1}
                className="px-2 py-1 rounded text-xs border border-surface-border text-zinc-400 disabled:text-zinc-700 disabled:border-zinc-800"
              >
                Prev
              </button>
              <span className="text-xs text-zinc-500">
                {agentsPage} / {totalPages}
              </span>
              <button
                onClick={() => setAgentsPage((p) => Math.min(totalPages, p + 1))}
                disabled={agentsPage >= totalPages}
                className="px-2 py-1 rounded text-xs border border-surface-border text-zinc-400 disabled:text-zinc-700 disabled:border-zinc-800"
              >
                Next
              </button>
            </div>
          )}
        </main>
      </div>

      {/* ── Modals ── */}

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-surface-raised border border-surface-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">
                {editing ? 'Edit Pool Agent' : 'New Pool Agent'}
              </h2>
              {saveError && (
                <div className="mb-4 rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-300">{saveError}</div>
              )}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    placeholder="e.g. Backend Architect"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Division *</label>
                    <select
                      value={form.division}
                      onChange={(e) => {
                        const idx = departments.findIndex((d) => d.name === e.target.value);
                        const slug = idx >= 0 ? departments[idx].slug : '';
                        setForm((p) => ({ ...p, division: e.target.value, divisionSlug: slug }));
                      }}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">Select division...</option>
                      {departments.map((d) => (
                        <option key={d.id} value={d.name}>{d.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Slug</label>
                    <input
                      value={form.divisionSlug}
                      onChange={(e) => setForm((p) => ({ ...p, divisionSlug: e.target.value }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">Description</label>
                  <input
                    value={form.description}
                    onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    placeholder="Brief summary (max 500 chars)"
                  />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Category</label>
                    <input
                      value={form.category}
                      onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Emoji</label>
                    <input
                      value={form.emoji ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, emoji: e.target.value }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-400 mb-1">Color</label>
                    <input
                      value={form.color ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, color: e.target.value }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1">System Prompt *</label>
                  <textarea
                    value={form.systemPrompt}
                    onChange={(e) => setForm((p) => ({ ...p, systemPrompt: e.target.value }))}
                    rows={6}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 font-mono resize-y"
                    placeholder="Full system prompt / instructions body..."
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm border border-surface-border text-zinc-400 hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="px-4 py-2 rounded-lg text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={() => setDeleteTarget(null)}
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-surface-raised border border-red-900/40 rounded-2xl w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-zinc-100">Delete &ldquo;{deleteTarget.name}&rdquo;?</h3>
              <p className="text-xs text-zinc-500 mt-1">This cannot be undone. Agents already deployed to tenants are unaffected (SetNull FKs).</p>
              {saveError && (
                <div className="mt-3 rounded-lg bg-red-950/40 border border-red-800 px-3 py-2 text-sm text-red-300">{saveError}</div>
              )}
              <div className="flex justify-end gap-2 mt-4">
                <button
                  onClick={() => setDeleteTarget(null)}
                  className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
                <button
                  onClick={() => void confirmDelete()}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-lg text-xs bg-red-700 hover:bg-red-600 text-white font-medium transition disabled:opacity-50"
                >
                  {saving ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
