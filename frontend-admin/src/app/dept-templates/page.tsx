'use client';

/**
 * /dept-templates
 *
 * SuperAdmin library for managing platform-wide Department Templates.
 * Each template is an org blueprint (list of departments + hierarchy)
 * that can be deployed to any tenant in one click.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import {
  deptTemplatesService,
  type DepartmentTemplate,
  type DeptStructureItem,
  type CreateDeptTemplatePayload,
} from '@/services/deptTemplates.service';
import api from '@/services/api';
import { unwrapList } from '@/services/unwrap';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TenantOption { id: string; name: string; slug: string; status: string; }

const CATEGORIES = ['general', 'startup', 'scaleup', 'ecommerce', 'saas', 'enterprise'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const EMPTY_STRUCTURE: DeptStructureItem[] = [{ name: '', description: '', headAgentType: '', parentName: '' }];

const EMPTY_FORM: CreateDeptTemplatePayload = {
  name: '', slug: '', description: '', category: 'general', tags: [], structure: EMPTY_STRUCTURE, isPublic: true,
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DeptTemplatesPage() {
  const user = useAdminAuth();
  const [templates, setTemplates] = useState<DepartmentTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const limit = 20;

  // CRUD modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentTemplate | null>(null);
  const [form, setForm] = useState<CreateDeptTemplatePayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<DepartmentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Deploy modal
  const [deployTarget, setDeployTarget] = useState<DepartmentTemplate | null>(null);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [selectedTenant, setSelectedTenant] = useState('');
  const [withAgents, setWithAgents] = useState(true);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ departments: number; agents: number } | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);

  // ─── Fetch templates ────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deptTemplatesService.list({
        category: catFilter === 'ALL' ? undefined : catFilter,
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
  }, [catFilter, page]);

  useEffect(() => { void load(); }, [load]);

  // ─── Fetch tenants for deploy dropdown ─────────────────────────────────────

  const loadTenants = useCallback(async () => {
    try {
      const res = await api.get('/tenants?limit=100');
      setTenants((unwrapList(res).items ?? []) as TenantOption[]);
    } catch { /* silent */ }
  }, []);

  useEffect(() => { if (deployTarget) void loadTenants(); }, [deployTarget, loadTenants]);

  // ─── Derived ───────────────────────────────────────────────────────────────

  const visible = search
    ? templates.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        (t.description ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : templates;

  const nonTier = visible.filter((t) => !(t.slug?.startsWith('tier-') || (t.tags ?? []).includes('tier') || t.name.startsWith('Tier:')));

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, structure: [{ name: '', description: '', headAgentType: '', parentName: '' }] });
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(t: DepartmentTemplate) {
    setEditTarget(t);
    setForm({
      name: t.name, slug: t.slug, description: t.description ?? '',
      category: t.category, tags: [...t.tags],
      structure: t.structure.length > 0 ? [...t.structure] : [{ name: '', description: '', headAgentType: '', parentName: '' }],
      isPublic: t.isPublic,
    });
    setSaveError(null);
    setModalOpen(true);
  }

  // Structure row helpers
  function addRow() {
    setForm((f) => ({ ...f, structure: [...f.structure, { name: '', description: '', headAgentType: '', parentName: '' }] }));
  }

  function removeRow(i: number) {
    setForm((f) => ({ ...f, structure: f.structure.filter((_, idx) => idx !== i) }));
  }

  function updateRow(i: number, field: keyof DeptStructureItem, val: string) {
    setForm((f) => {
      const s = [...f.structure];
      s[i] = { ...s[i], [field]: val };
      return { ...f, structure: s };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('Name is required'); return; }
    if (!form.slug.trim()) { setSaveError('Slug is required'); return; }
    const validRows = form.structure.filter((r) => r.name.trim());
    if (validRows.length === 0) { setSaveError('Add at least one department to the structure'); return; }
    setSaving(true);
    setSaveError(null);
    try {
      const payload = { ...form, structure: validRows };
      if (editTarget) {
        const { slug: _s, ...updatePayload } = payload; // slug not updatable
        await deptTemplatesService.update(editTarget.id, updatePayload);
      } else {
        await deptTemplatesService.create(payload);
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
      await deptTemplatesService.remove(deleteTarget.id);
      setDeleteTarget(null);
      void load();
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeploy() {
    if (!deployTarget || !selectedTenant) return;
    setDeploying(true);
    setDeployError(null);
    setDeployResult(null);
    try {
      const result = await deptTemplatesService.deployToTenant(selectedTenant, deployTarget.id, withAgents);
      setDeployResult(result);
    } catch (err: unknown) {
      setDeployError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeploying(false);
    }
  }

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">

        {/* ── Header ── */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Department Template Library</h1>
            <p className="text-sm text-zinc-500 mt-0.5">
              Org structure blueprints. Deploy any template to a tenant to instantly create their departments.
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
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search templates…"
            className="flex-1 min-w-56 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <div className="flex gap-1 flex-wrap">
            {(['ALL', ...CATEGORIES]).map((c) => (
              <button key={c} onClick={() => { setCatFilter(c); setPage(1); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition capitalize ${
                  catFilter === c ? 'bg-indigo-600 text-white' : 'border border-surface-border text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
          <span className="text-xs text-zinc-600 ml-auto">{nonTier.length} templates</span>
        </div>

        {/* ── Cards ── */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-52 rounded-xl bg-surface-raised animate-pulse" />
            ))}
          </div>
        ) : nonTier.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-sm">
            No templates found.
            {user.role === 'SUPER_ADMIN' && (
              <>
                {' '}
                <button onClick={openCreate} className="text-indigo-400 hover:underline">Create one.</button>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {nonTier.map((tmpl) => (
                <motion.div key={tmpl.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-indigo-700/50 transition"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">{tmpl.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{tmpl.description}</div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-300 capitalize">
                      {tmpl.category}
                    </span>
                  </div>

                  {/* Structure preview */}
                  <div className="rounded-lg bg-surface-overlay border border-surface-border/50 p-2.5 space-y-1 max-h-28 overflow-y-auto">
                    {tmpl.structure.map((item, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs">
                        <span className="text-zinc-600">{item.parentName ? '  └' : '◆'}</span>
                        <span className="text-zinc-300 truncate">{item.name}</span>
                        {item.headAgentType && (
                          <span className="text-zinc-600 text-[10px]">({item.headAgentType})</span>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Tags */}
                  {tmpl.tags.length > 0 && (
                    <div className="flex gap-1 flex-wrap">
                      {tmpl.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-zinc-800 text-zinc-400 px-2 py-0.5 text-[10px]">{tag}</span>
                      ))}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                    {user.role === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => {
                          setDeployTarget(tmpl);
                          setDeployResult(null);
                          setDeployError(null);
                          setSelectedTenant('');
                        }}
                        className="flex-1 py-1.5 rounded-lg text-xs bg-indigo-700 hover:bg-indigo-600 text-white font-medium transition"
                      >
                        Deploy →
                      </button>
                    )}
                    {user.role === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => openEdit(tmpl)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 transition"
                      >
                        Edit
                      </button>
                    )}
                    {user.role === 'SUPER_ADMIN' && (
                      <button
                        onClick={() => setDeleteTarget(tmpl)}
                        className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-red-400 hover:border-red-700 transition"
                      >
                        ✕
                      </button>
                    )}
                    {user.role !== 'SUPER_ADMIN' && (
                      <div className="text-xs text-zinc-600 py-1.5">Read-only</div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Pagination */}
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

      {/* ═══════════════ Create / Edit Modal ═══════════════ */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          >
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
            >
              <h2 className="text-base font-semibold text-zinc-100 mb-5">
                {editTarget ? `Edit: ${editTarget.name}` : 'Create Department Template'}
              </h2>

              <div className="space-y-4">
                {/* Name + slug */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Name *</label>
                    <input value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editTarget ? f.slug : slugify(e.target.value) }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="e.g. Scale-Up Business"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Slug {editTarget && <span className="text-zinc-600">(locked)</span>}</label>
                    <input value={form.slug}
                      onChange={(e) => !editTarget && setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                      readOnly={!!editTarget}
                      className={`w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${editTarget ? 'text-zinc-500 cursor-not-allowed' : 'text-zinc-200'}`}
                      placeholder="scale-up-business"
                    />
                  </div>
                </div>

                {/* Category + description */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Category</label>
                    <select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      {CATEGORIES.map((c) => <option key={c} value={c} className="capitalize">{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Tags (comma-separated)</label>
                    <input value={(form.tags ?? []).join(', ')}
                      onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="startup, lean, b2b"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="What type of company is this structure for?"
                  />
                </div>

                {/* Structure builder */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-zinc-400">Department Structure</label>
                    <button onClick={addRow}
                      className="text-xs text-indigo-400 hover:text-indigo-300 transition"
                    >+ Add Row</button>
                  </div>
                  <div className="rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-2 max-h-72 overflow-y-auto">
                    {/* Column headers */}
                    <div className="grid grid-cols-[2fr_2fr_1.5fr_1.5fr_auto] gap-2 text-[10px] text-zinc-600 uppercase tracking-wider px-1">
                      <span>Name *</span><span>Description</span><span>Head Agent Type</span><span>Parent Name</span><span></span>
                    </div>
                    {form.structure.map((row, i) => (
                      <div key={i} className="grid grid-cols-[2fr_2fr_1.5fr_1.5fr_auto] gap-2 items-center">
                        <input value={row.name} onChange={(e) => updateRow(i, 'name', e.target.value)}
                          className="rounded border border-surface-border bg-surface text-zinc-200 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="Finance"
                        />
                        <input value={row.description ?? ''} onChange={(e) => updateRow(i, 'description', e.target.value)}
                          className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="Optional…"
                        />
                        <input value={row.headAgentType ?? ''} onChange={(e) => updateRow(i, 'headAgentType', e.target.value)}
                          className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="EXECUTIVE"
                        />
                        <input value={row.parentName ?? ''} onChange={(e) => updateRow(i, 'parentName', e.target.value)}
                          className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="Executive"
                        />
                        <button onClick={() => removeRow(i)} className="text-zinc-600 hover:text-red-400 transition text-xs px-1">✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                {saveError && (
                  <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">{saveError}</div>
                )}

                <div className="flex gap-3 pt-2">
                  <button onClick={() => setModalOpen(false)}
                    className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                  >Cancel</button>
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

      {/* ═══════════════ Delete Confirm ═══════════════ */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              className="w-full max-w-sm rounded-2xl border border-red-800/40 bg-surface-raised p-6 shadow-2xl"
            >
              <h3 className="text-base font-semibold text-zinc-100 mb-2">Delete Template?</h3>
              <p className="text-sm text-zinc-400 mb-5">
                "<span className="text-zinc-200 font-medium">{deleteTarget.name}</span>" will be permanently removed.
                Departments already deployed from this template will not be affected.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                >Cancel</button>
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

      {/* ═══════════════ Deploy Modal ═══════════════ */}
      <AnimatePresence>
        {deployTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && !deploying && setDeployTarget(null)}
          >
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-lg rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
            >
              <h2 className="text-base font-semibold text-zinc-100 mb-1">Deploy Department Template</h2>
              <p className="text-sm text-zinc-500 mb-5">
                This will create real Department records for the selected tenant based on{' '}
                <span className="text-zinc-300 font-medium">"{deployTarget.name}"</span>.
              </p>

              {/* Template structure preview */}
              <div className="rounded-lg bg-surface-overlay border border-surface-border/50 p-3 mb-5 space-y-1 max-h-36 overflow-y-auto">
                {deployTarget.structure.map((item, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-xs">
                    <span className="text-zinc-600">{item.parentName ? ' └' : '◆'}</span>
                    <span className="text-zinc-300">{item.name}</span>
                    {item.headAgentType && <span className="text-zinc-600">({item.headAgentType})</span>}
                  </div>
                ))}
              </div>

              {!deployResult ? (
                <>
                  {/* Tenant selector */}
                  <div className="mb-4">
                    <label className="text-xs text-zinc-400 mb-1.5 block">Select Target Tenant *</label>
                    <select value={selectedTenant} onChange={(e) => setSelectedTenant(e.target.value)}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                    >
                      <option value="">— choose a tenant —</option>
                      {tenants.map((t) => (
                        <option key={t.id} value={t.id}>{t.name} ({t.slug}) — {t.status}</option>
                      ))}
                    </select>
                  </div>

                  {/* With agents toggle */}
                  <label className="flex items-center gap-3 cursor-pointer mb-5">
                    <div
                      onClick={() => setWithAgents((v) => !v)}
                      className={`relative w-10 h-5 rounded-full transition ${withAgents ? 'bg-indigo-600' : 'bg-zinc-700'}`}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${withAgents ? 'translate-x-5' : 'translate-x-0.5'}`} />
                    </div>
                    <div>
                      <div className="text-sm text-zinc-200">Auto-create head agents</div>
                      <div className="text-xs text-zinc-500">Spawns a lead agent for each department using a matching platform template.</div>
                    </div>
                  </label>

                  {deployError && (
                    <div className="mb-4 rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300">{deployError}</div>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setDeployTarget(null)} disabled={deploying}
                      className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition disabled:opacity-40"
                    >Cancel</button>
                    <button onClick={handleDeploy} disabled={!selectedTenant || deploying}
                      className="flex-1 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
                    >
                      {deploying ? 'Deploying…' : 'Deploy Now'}
                    </button>
                  </div>
                </>
              ) : (
                /* Success state */
                <div className="text-center py-4">
                  <div className="text-green-400 text-3xl mb-3">✓</div>
                  <div className="text-zinc-100 font-semibold mb-1">Deployment Successful</div>
                  <div className="text-sm text-zinc-400 mb-5">
                    Created <span className="text-zinc-200 font-medium">{deployResult.departments} departments</span>
                    {deployResult.agents > 0 && (
                      <> and <span className="text-zinc-200 font-medium">{deployResult.agents} agents</span></>
                    )}{' '}for the selected tenant.
                  </div>
                  <button onClick={() => setDeployTarget(null)}
                    className="px-6 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
                  >
                    Close
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
