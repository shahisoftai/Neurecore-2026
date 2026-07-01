'use client';

/**
 * /agent-templates
 *
 * SuperAdmin library for managing platform-wide prebuilt Business AI Agent templates.
 * S — renders the template library list + modals; delegates API calls to agentTemplatesService.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { agentTemplatesService, type AgentTemplate, type CreateAgentTemplatePayload } from '@/services/agentTemplates.service';

// ─── Constants ────────────────────────────────────────────────────────────────

const AGENT_TYPES = ['CORE', 'FUNCTIONAL', 'EXECUTIVE', 'META'] as const;
const MODELS = ['gpt-4o', 'gpt-4o-mini', 'claude-3-5-sonnet-20241022', 'claude-3-haiku-20240307'];

const TYPE_COLOR: Record<string, string> = {
  EXECUTIVE: 'bg-purple-900 text-purple-300',
  CORE:      'bg-blue-900 text-blue-300',
  FUNCTIONAL:'bg-indigo-900 text-indigo-300',
  META:      'bg-amber-900 text-amber-300',
};

const PERMISSION_OPTIONS = [
  'read_all', 'read_financials', 'read_crm', 'read_hr_data',
  'read_contracts', 'read_audit_logs', 'read_agent_metrics', 'read_analytics',
  'create_reports', 'create_tasks', 'create_purchase_orders',
  'send_emails', 'update_crm', 'update_tickets',
  'orchestrate_agents', 'manage_workflows', 'assign_tasks',
  'approve_decisions', 'approve_expenses', 'flag_anomalies', 'flag_issues', 'flag_risks', 'flag_violations',
  'access_billing', 'access_calendar', 'access_governance', 'access_analytics',
  'access_knowledge_base', 'access_vendor_db', 'access_scheduling',
  'web_search', 'manage_campaigns', 'create_content',
];

// ─── Form state ───────────────────────────────────────────────────────────────

const EMPTY_FORM: CreateAgentTemplatePayload = {
  name: '', description: '', type: 'FUNCTIONAL', model: 'gpt-4o-mini',
  systemPrompt: '', instructions: '', permissions: [], config: { allowTenantEditing: true }, version: '1.0.0',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AgentTemplatesPage() {
  const user = useAdminAuth();
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AgentTemplate | null>(null);
  const [form, setForm] = useState<CreateAgentTemplatePayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<AgentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Data fetching ─────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentTemplatesService.list({
        type: typeFilter === 'ALL' ? undefined : typeFilter,
        page,
        limit,
      });
      setTemplates(res.items);
      setTotal(res.total);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, [typeFilter, page]);

  useEffect(() => { void load(); }, [load]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const visible = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM });
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(t: AgentTemplate) {
    setEditTarget(t);
    setForm({
      name: t.name,
      description: t.description ?? '',
      type: t.type,
      model: t.model,
      systemPrompt: t.systemPrompt ?? '',
      instructions: t.instructions ?? '',
      permissions: [...t.permissions],
      config: { ...t.config },
      version: t.version,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('Name is required'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      if (editTarget) {
        await agentTemplatesService.update(editTarget.id, form);
      } else {
        await agentTemplatesService.create(form);
      }
      setModalOpen(false);
      void load();
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await agentTemplatesService.remove(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } finally {
      setDeleting(false);
    }
  }

  function togglePermission(perm: string) {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions?.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...(prev.permissions ?? []), perm],
    }));
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Agent Template Library</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Platform-wide prebuilt Business AI Agents. Tenants deploy instances from these.
            </p>
          </div>
          {user.role === 'SUPER_ADMIN' && (
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              + New Template
            </button>
          )}
        </div>

        {/* ── Toolbar ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or description…"
            className="flex-1 min-w-56 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <div className="flex gap-1">
            {(['ALL', ...AGENT_TYPES] as string[]).map((t) => (
              <button
                key={t}
                onClick={() => { setTypeFilter(t); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  typeFilter === t
                    ? 'bg-indigo-600 text-white'
                    : 'border border-surface-border text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-600 ml-auto">{total} templates</span>
        </div>

        {/* ── Grid ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-xl bg-surface-raised animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            No templates found.
            {user.role === 'SUPER_ADMIN' && (
              <>
                {' '}
                <button onClick={openCreate} className="text-indigo-400 hover:underline">Create the first one.</button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {visible.map((tmpl) => (
                <motion.div
                  key={tmpl.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-indigo-700/50 transition group"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">{tmpl.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{tmpl.description}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLOR[tmpl.type] ?? 'bg-zinc-800 text-zinc-300'}`}>
                      {tmpl.type}
                    </span>
                  </div>

                  {/* Meta row */}
                  <div className="flex gap-3 text-xs text-zinc-500">
                    <span className="truncate">⬡ {tmpl.model}</span>
                    <span>v{tmpl.version}</span>
                    <span>{tmpl.permissions.length} perms</span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                    {user.role === 'SUPER_ADMIN' ? (
                      <>
                        <button
                          onClick={() => openEdit(tmpl)}
                          className="flex-1 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 hover:border-indigo-500 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tmpl)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-red-400 hover:border-red-700 transition"
                        >
                          Delete
                        </button>
                      </>
                    ) : (
                      <div className="text-xs text-zinc-600 py-1.5">Read-only</div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* ── Pagination ── */}
        {total > limit && (
          <div className="flex items-center justify-center gap-2 pt-2">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition"
            >← Prev</button>
            <span className="text-xs text-zinc-500">Page {page} of {Math.ceil(total / limit)}</span>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= Math.ceil(total / limit)}
              className="px-3 py-1.5 rounded-lg border border-surface-border text-xs text-zinc-400 hover:text-zinc-200 disabled:opacity-40 transition"
            >Next →</button>
          </div>
        )}
      </div>

      {/* ═══════════════════════ Create / Edit Modal ═══════════════════════ */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
            >
              <h2 className="text-base font-semibold text-zinc-100 mb-5">
                {editTarget ? `Edit: ${editTarget.name}` : 'Create New Agent Template'}
              </h2>

              <div className="space-y-4">
                {/* Name + Type row */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Name *</label>
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. Sales Manager"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Type</label>
                    <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as AgentTemplate['type'] }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      {AGENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>

                {/* Model + Version */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Model</label>
                    <select value={form.model} onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      {MODELS.map((m) => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Version</label>
                    <input value={form.version} onChange={(e) => setForm((f) => ({ ...f, version: e.target.value }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="1.0.0"
                    />
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="Short description of what this agent does…"
                  />
                </div>

                {/* System Prompt */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">System Prompt</label>
                  <textarea value={form.systemPrompt} onChange={(e) => setForm((f) => ({ ...f, systemPrompt: e.target.value }))} rows={5}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 font-mono focus:outline-none focus:border-indigo-500 resize-y"
                    placeholder="You are the [role]. Your responsibilities include…"
                  />
                </div>

                {/* Instructions */}
                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Instructions</label>
                  <textarea value={form.instructions} onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))} rows={2}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="Behavioural guidelines for this agent…"
                  />
                </div>

                {/* Tenant edit toggle */}
                <label className="flex items-center gap-3 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={Boolean((form.config as any)?.allowTenantEditing)}
                    onChange={() =>
                      setForm((f) => ({
                        ...f,
                        config: {
                          ...(f.config ?? {}),
                          allowTenantEditing: !Boolean((f.config as any)?.allowTenantEditing),
                        },
                      }))
                    }
                    className="rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                  />
                  <div>
                    <div className="text-sm text-zinc-200">Allow tenant editing (clone)</div>
                    <div className="text-xs text-zinc-500">If enabled, tenant admins can clone this template and edit TORs safely.</div>
                  </div>
                </label>

                {/* Permissions */}
                <div>
                  <label className="text-xs text-zinc-400 mb-2 block">Permissions ({form.permissions?.length ?? 0} selected)</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 max-h-44 overflow-y-auto rounded-lg border border-surface-border bg-surface-overlay p-3">
                    {PERMISSION_OPTIONS.map((perm) => (
                      <label key={perm} className="flex items-center gap-1.5 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={form.permissions?.includes(perm) ?? false}
                          onChange={() => togglePermission(perm)}
                          className="rounded border-zinc-600 bg-surface-overlay accent-indigo-500"
                        />
                        <span className="text-xs text-zinc-400 group-hover:text-zinc-200 transition truncate">{perm}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {saveError && (
                  <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">{saveError}</div>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setModalOpen(false)}
                    className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                  >
                    Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
                  >
                    {saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Template'}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════ Delete Confirm ═══════════════════════ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              className="w-full max-w-sm rounded-2xl border border-red-800/40 bg-surface-raised p-6 shadow-2xl"
            >
              <h3 className="text-base font-semibold text-zinc-100 mb-2">Delete Template?</h3>
              <p className="text-sm text-zinc-400 mb-5">
                <span className="text-zinc-200 font-medium">"{deleteTarget.name}"</span> will be permanently deleted.
                Agents already deployed from this template will not be affected.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                >
                  Cancel
                </button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
