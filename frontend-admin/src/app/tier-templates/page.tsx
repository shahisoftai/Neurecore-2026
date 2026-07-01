'use client';

/**
 * /tier-templates
 *
 * SuperAdmin library for managing Tier Templates (Starter/Growth/Enterprise/Autonomous).
 * These are stored as DepartmentTemplate records (slug starts with "tier-") and
 * include `agentTemplateNames[]` per department item.
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

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
}

const EMPTY_ROW: DeptStructureItem = {
  name: '',
  description: '',
  parentName: '',
  headAgentType: '',
  agentTemplateNames: [],
};

const EMPTY_FORM: CreateDeptTemplatePayload = {
  name: 'Tier: ',
  slug: 'tier-',
  description: '',
  category: 'enterprise',
  tags: ['tier'],
  isPublic: true,
  structure: [EMPTY_ROW],
};

function isTier(t: DepartmentTemplate) {
  return t.slug?.startsWith('tier-') || t.name.startsWith('Tier:') || (t.tags ?? []).includes('tier');
}

export default function TierTemplatesPage() {
  const user = useAdminAuth();
  const [templates, setTemplates] = useState<DepartmentTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<DepartmentTemplate | null>(null);
  const [form, setForm] = useState<CreateDeptTemplatePayload>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<DepartmentTemplate | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await deptTemplatesService.list({ limit: 200 });
      setTemplates((res.items ?? []).filter(isTier));
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const visible = (search ? templates.filter((t) => t.name.toLowerCase().includes(search.toLowerCase())) : templates)
    .sort((a, b) => a.name.localeCompare(b.name));

  function openCreate() {
    setEditTarget(null);
    setForm({ ...EMPTY_FORM, structure: [{ ...EMPTY_ROW }] });
    setSaveError(null);
    setModalOpen(true);
  }

  function openEdit(t: DepartmentTemplate) {
    setEditTarget(t);
    setForm({
      name: t.name,
      slug: t.slug,
      description: t.description ?? '',
      category: t.category,
      tags: [...(t.tags ?? [])],
      isPublic: t.isPublic,
      structure: (t.structure?.length ? t.structure : [{ ...EMPTY_ROW }]).map((r) => ({
        name: r.name,
        description: r.description ?? '',
        parentName: r.parentName ?? '',
        headAgentType: r.headAgentType ?? '',
        agentTemplateNames: [...(r.agentTemplateNames ?? [])],
      })),
    });
    setSaveError(null);
    setModalOpen(true);
  }

  function addRow() {
    setForm((f) => ({ ...f, structure: [...f.structure, { ...EMPTY_ROW }] }));
  }

  function removeRow(i: number) {
    setForm((f) => ({ ...f, structure: f.structure.filter((_, idx) => idx !== i) }));
  }

  function updateRow(i: number, patch: Partial<DeptStructureItem>) {
    setForm((f) => {
      const s = [...f.structure];
      s[i] = { ...s[i], ...patch };
      return { ...f, structure: s };
    });
  }

  async function handleSave() {
    if (!form.name.trim()) { setSaveError('Name is required'); return; }
    if (!form.slug.trim()) { setSaveError('Slug is required'); return; }
    if (!form.slug.startsWith('tier-')) { setSaveError('Tier template slug must start with "tier-"'); return; }

    const validRows = form.structure
      .filter((r) => r.name.trim())
      .map((r) => ({
        ...r,
        agentTemplateNames: (r.agentTemplateNames ?? []).filter(Boolean),
      }));

    if (validRows.length === 0) { setSaveError('Add at least one department row'); return; }

    setSaving(true);
    setSaveError(null);
    try {
      const payload: CreateDeptTemplatePayload = {
        ...form,
        tags: Array.from(new Set([...(form.tags ?? []), 'tier'])),
        category: form.category ?? 'enterprise',
        structure: validRows,
      };

      if (editTarget) {
        const { slug: _slug, ...updatePayload } = payload;
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

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100">Tier Templates</h1>
            <p className="text-sm text-zinc-500 mt-0.5">Starter / Growth / Enterprise / Autonomous deployment blueprints.</p>
          </div>
          {user.role === 'SUPER_ADMIN' && (
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition"
            >
              + New Tier
            </button>
          )}
        </div>

        <div className="flex gap-3 items-center">
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tiers…"
            className="flex-1 min-w-56 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <span className="text-xs text-zinc-600">{templates.length} tiers</span>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-48 rounded-xl bg-surface-raised animate-pulse" />
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div className="py-20 text-center text-zinc-500 text-sm">No tiers found.</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {visible.map((tmpl) => (
                <motion.div key={tmpl.id}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  className="rounded-xl border border-surface-border bg-surface-raised p-4 flex flex-col gap-3 hover:border-indigo-700/50 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-zinc-100 truncate">{tmpl.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{tmpl.description}</div>
                    </div>
                    <span className="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium bg-zinc-800 text-zinc-300">tier</span>
                  </div>

                  <div className="rounded-lg bg-surface-overlay border border-surface-border/50 p-2.5 space-y-1 max-h-32 overflow-y-auto">
                    {tmpl.structure.map((item, i) => (
                      <div key={i} className="text-xs text-zinc-400">
                        <span className="text-zinc-300">{item.name}</span>
                        {item.agentTemplateNames?.length ? (
                          <span className="text-zinc-600"> — {item.agentTemplateNames.length} agents</span>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-auto pt-2 border-t border-surface-border/50">
                    {user.role === 'SUPER_ADMIN' ? (
                      <>
                        <button
                          onClick={() => openEdit(tmpl)}
                          className="flex-1 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-400 hover:text-zinc-200 transition"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(tmpl)}
                          className="px-3 py-1.5 rounded-lg text-xs border border-surface-border text-zinc-600 hover:text-red-400 hover:border-red-700 transition"
                        >
                          ✕
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
      </div>

      {/* Modal */}
      <AnimatePresence>
        {modalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
            onClick={(e) => e.target === e.currentTarget && setModalOpen(false)}
          >
            <motion.div initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.96, opacity: 0 }}
              className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-border bg-surface-raised p-6 shadow-2xl"
            >
              <h2 className="text-base font-semibold text-zinc-100 mb-5">
                {editTarget ? `Edit: ${editTarget.name}` : 'Create Tier Template'}
              </h2>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Name *</label>
                    <input value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value, slug: editTarget ? f.slug : `tier-${slugify(e.target.value.replace(/^Tier:\s*/i, ''))}` }))}
                      className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      placeholder="Tier: Starter"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-zinc-400 mb-1 block">Slug {editTarget && <span className="text-zinc-600">(locked)</span>}</label>
                    <input value={form.slug}
                      onChange={(e) => !editTarget && setForm((f) => ({ ...f, slug: slugify(e.target.value) }))}
                      readOnly={!!editTarget}
                      className={`w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm focus:outline-none focus:border-indigo-500 ${editTarget ? 'text-zinc-500 cursor-not-allowed' : 'text-zinc-200'}`}
                      placeholder="tier-starter"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs text-zinc-400 mb-1 block">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2}
                    className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 resize-none"
                    placeholder="What does this tier include?"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-zinc-400">Tier Structure (Departments + Agents)</label>
                    <button onClick={addRow} className="text-xs text-indigo-400 hover:text-indigo-300 transition">+ Add Row</button>
                  </div>

                  <div className="rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-2 max-h-[420px] overflow-y-auto">
                    <div className="grid grid-cols-[1.3fr_1.3fr_1.1fr_1fr_1.8fr_auto] gap-2 text-[10px] text-zinc-600 uppercase tracking-wider px-1">
                      <span>Dept Name *</span>
                      <span>Description</span>
                      <span>Head Type</span>
                      <span>Parent Name</span>
                      <span>Agent Template Names (CSV)</span>
                      <span></span>
                    </div>

                    {form.structure.map((row, i) => (
                      <div key={i} className="grid grid-cols-[1.3fr_1.3fr_1.1fr_1fr_1.8fr_auto] gap-2 items-center">
                        <input value={row.name}
                          onChange={(e) => updateRow(i, { name: e.target.value })}
                          className="rounded border border-surface-border bg-surface text-zinc-200 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="Finance"
                        />
                        <input value={row.description ?? ''}
                          onChange={(e) => updateRow(i, { description: e.target.value })}
                          className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="Optional…"
                        />
                        <input value={row.headAgentType ?? ''}
                          onChange={(e) => updateRow(i, { headAgentType: e.target.value })}
                          className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="EXECUTIVE"
                        />
                        <input value={row.parentName ?? ''}
                          onChange={(e) => updateRow(i, { parentName: e.target.value })}
                          className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="Executive"
                        />
                        <input value={(row.agentTemplateNames ?? []).join(', ')}
                          onChange={(e) => updateRow(i, { agentTemplateNames: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
                          className="rounded border border-surface-border bg-surface text-zinc-400 text-xs px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                          placeholder="CEO Agent, CFO Agent, COO Agent"
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
                  >{saving ? 'Saving…' : editTarget ? 'Save Changes' : 'Create Tier'}</button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirm */}
      <AnimatePresence>
        {deleteTarget && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
          >
            <motion.div initial={{ scale: 0.96 }} animate={{ scale: 1 }} exit={{ scale: 0.96 }}
              className="w-full max-w-sm rounded-2xl border border-red-800/40 bg-surface-raised p-6 shadow-2xl"
            >
              <h3 className="text-base font-semibold text-zinc-100 mb-2">Delete Tier?</h3>
              <p className="text-sm text-zinc-400 mb-5">
                "<span className="text-zinc-200 font-medium">{deleteTarget.name}</span>" will be permanently removed.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setDeleteTarget(null)}
                  className="flex-1 py-2 rounded-lg border border-surface-border text-sm text-zinc-400 hover:text-zinc-200 transition"
                >Cancel</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-medium transition disabled:opacity-50"
                >{deleting ? 'Deleting…' : 'Delete'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </AdminShell>
  );
}
