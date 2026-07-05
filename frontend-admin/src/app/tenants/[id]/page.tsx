'use client';

/**
 * /tenants/[id]
 *
 * Tenant detail view with four tabs:
 *   Overview  — basic info + quick stats
 *   Departments — departments already deployed for this tenant
 *   Agents      — agents currently running for this tenant
 *   Deploy      — two deployment flows:
 *                   1. Deploy Org Structure (dept template → real depts)
 *                   2. Deploy Agents        (bulk agent template → real agents)
 */

import { useState, useEffect, useCallback, use } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapItem, unwrapList } from '@/services/unwrap';
import { deptTemplatesService, type DepartmentTemplate, type BulkAgentDeployItem } from '@/services/deptTemplates.service';
import { agentTemplatesService, type AgentTemplate } from '@/services/agentTemplates.service';
import type { Tenant } from '@/types/api.types';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Department { id: string; name: string; description?: string; createdAt: string; }
interface Agent { id: string; name: string; type: string; model: string; status: string; createdAt: string; }

type Tab = 'overview' | 'departments' | 'agents' | 'deploy';

const TABS: { id: Tab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'departments', label: 'Departments' },
  { id: 'agents', label: 'Agents' },
  { id: 'deploy', label: 'Deploy' },
];

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: 'bg-green-900/70 text-green-300',
  TRIAL: 'bg-blue-900/70 text-blue-300',
  SUSPENDED: 'bg-yellow-900/70 text-yellow-300',
  CANCELLED: 'bg-red-900/70 text-red-300',
};

const AGENT_TYPE_BADGE: Record<string, string> = {
  EXECUTIVE: 'bg-purple-900/70 text-purple-300',
  CORE: 'bg-indigo-900/70 text-indigo-300',
  FUNCTIONAL: 'bg-teal-900/70 text-teal-300',
  META: 'bg-orange-900/70 text-orange-300',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: tenantId } = use(params);
  const router = useRouter();
  const user = useAdminAuth();

  const [tab, setTab] = useState<Tab>('overview');
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loadingTenant, setLoadingTenant] = useState(true);

  // departments + agents lists
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Deploy: Dept Template flow
  const [deptTemplates, setDeptTemplates] = useState<DepartmentTemplate[]>([]);
  const [selectedDeptTmpl, setSelectedDeptTmpl] = useState('');
  const [withAgents, setWithAgents] = useState(true);
  const [deployingDept, setDeployingDept] = useState(false);
  const [deptDeployResult, setDeptDeployResult] = useState<{ departments: number; agents: number } | null>(null);
  const [deptDeployError, setDeptDeployError] = useState<string | null>(null);

  // Deploy: Bulk agents flow
  const [agentTemplateList, setAgentTemplateList] = useState<AgentTemplate[]>([]);
  const [agentRows, setAgentRows] = useState<BulkAgentDeployItem[]>([]);
  const [deployingAgents, setDeployingAgents] = useState(false);
  const [agentDeployResult, setAgentDeployResult] = useState<number | null>(null);
  const [agentDeployError, setAgentDeployError] = useState<string | null>(null);
  const [addTemplateId, setAddTemplateId] = useState('');

  // ─── Fetch tenant ──────────────────────────────────────────────────────────

  useEffect(() => {
    (async () => {
      setLoadingTenant(true);
      try {
        const res = await api.get(`/tenants/${tenantId}`);
        setTenant(unwrapItem(res) as Tenant);
      } catch {
        // not found
      } finally {
        setLoadingTenant(false);
      }
    })();
  }, [tenantId]);

  // ─── Tab-specific fetch ────────────────────────────────────────────────────

  const loadDepts = useCallback(async () => {
    if (!tenantId) return;
    setLoadingDepts(true);
    try {
      const res = await api.get(`/departments?tenantId=${tenantId}&limit=100`);
      setDepartments(unwrapList(res).items as Department[]);
    } finally { setLoadingDepts(false); }
  }, [tenantId]);

  const loadAgents = useCallback(async () => {
    if (!tenantId) return;
    setLoadingAgents(true);
    try {
      const res = await api.get(`/agents?tenantId=${tenantId}&limit=100`);
      setAgents(unwrapList(res).items as Agent[]);
    } finally { setLoadingAgents(false); }
  }, [tenantId]);

  const loadDeployAssets = useCallback(async () => {
    const [dtRes, atRes] = await Promise.all([
      deptTemplatesService.list({ limit: 100 }),
      agentTemplatesService.list({ limit: 100 }),
    ]);
    setDeptTemplates(dtRes.items);
    setAgentTemplateList(atRes.items);
  }, []);

  useEffect(() => {
    if (tab === 'departments') void loadDepts();
    if (tab === 'agents') void loadAgents();
    if (tab === 'deploy') void loadDeployAssets();
  }, [tab, loadDepts, loadAgents, loadDeployAssets]);

  // ─── Deploy: Dept Template ─────────────────────────────────────────────────

  async function handleDeployDeptTemplate() {
    if (!selectedDeptTmpl) return;
    setDeployingDept(true);
    setDeptDeployError(null);
    setDeptDeployResult(null);
    try {
      const result = await deptTemplatesService.deployToTenant(tenantId, selectedDeptTmpl, withAgents);
      setDeptDeployResult(result);
    } catch (err: unknown) {
      setDeptDeployError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeployingDept(false);
    }
  }

  // ─── Deploy: Bulk Agents ───────────────────────────────────────────────────

  function addAgentRow() {
    if (!addTemplateId) return;
    const tmpl = agentTemplateList.find((t) => t.id === addTemplateId);
    if (!tmpl) return;
    setAgentRows((rows) => [
      ...rows,
      { templateId: tmpl.id, name: tmpl.name, budgetPerDay: 100, authorityLevel: 'RECOMMEND' },
    ]);
    setAddTemplateId('');
  }

  function updateAgentRow(i: number, patch: Partial<BulkAgentDeployItem>) {
    setAgentRows((rows) => rows.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function removeAgentRow(i: number) {
    setAgentRows((rows) => rows.filter((_, idx) => idx !== i));
  }

  async function handleBulkDeploy() {
    if (agentRows.length === 0) return;
    setDeployingAgents(true);
    setAgentDeployError(null);
    setAgentDeployResult(null);
    try {
      await deptTemplatesService.bulkDeployAgents(tenantId, agentRows);
      setAgentDeployResult(agentRows.length);
      setAgentRows([]);
    } catch (err: unknown) {
      setAgentDeployError(err instanceof Error ? err.message : 'Deployment failed');
    } finally {
      setDeployingAgents(false);
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-5xl mx-auto space-y-5">

        {/* ── Back link + Header ── */}
        <button onClick={() => router.push('/tenants')}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition flex items-center gap-1">
          ← All Tenants
        </button>

        {loadingTenant ? (
          <div className="h-20 rounded-xl bg-surface-raised animate-pulse" />
        ) : tenant ? (
          <div className="rounded-xl border border-surface-border bg-surface-raised p-5 flex flex-wrap gap-6 items-start">
            <div>
              <h1 className="text-xl font-semibold text-zinc-100">{tenant.name}</h1>
              <div className="text-sm text-zinc-500 mt-0.5 font-mono">{tenant.slug}</div>
            </div>
            <div className="flex flex-wrap gap-3 items-center ml-auto">
              <Stat label="Plan" value={tenant.tier?.name ?? tenant.tier?.slug ?? tenant.plan ?? '—'} />
              <Stat label="Agent Limit" value={String(tenant.tier?.maxAgents ?? tenant.agentLimit ?? '—')} />
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[tenant.status] ?? 'bg-zinc-800 text-zinc-400'}`}>
                {tenant.status}
              </span>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-zinc-500">Tenant not found.</div>
        )}

        {/* ── Tabs ── */}
        <div className="flex gap-1 border-b border-surface-border/50">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-medium transition border-b-2 -mb-px ${
                tab === t.id
                  ? 'border-indigo-500 text-indigo-300'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* ══ Overview ══ */}
          {tab === 'overview' && (
            <motion.div key="overview" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4"
            >
              {tenant && (
                <>
                  <StatCard label="ID" value={tenant.id.slice(0, 8) + '…'} />
                  <StatCard label="Plan" value={tenant.tier?.name ?? tenant.tier?.slug ?? tenant.plan ?? '—'} />
                  <StatCard label="Agent Limit" value={String(tenant.tier?.maxAgents ?? tenant.agentLimit ?? '—')} />
                  <StatCard label="Departments" value={String(tenant.tier?.maxDepartments ?? '—')} />
                  <StatCard label="Created" value={new Date(tenant.createdAt).toLocaleDateString()} />
                </>
              )}
            </motion.div>
          )}

          {/* ══ Departments ══ */}
          {tab === 'departments' && (
            <motion.div key="departments" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingDepts ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-surface-raised animate-pulse" />)}</div>
              ) : departments.length === 0 ? (
                <Empty message="No departments yet." action="Deploy Org Structure" onAction={() => setTab('deploy')} />
              ) : (
                <div className="rounded-xl border border-surface-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border bg-surface-raised">
                        <Th>Name</Th><Th>Description</Th><Th>Created</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {departments.map((d, i) => (
                        <tr key={d.id} className={`border-b border-surface-border/50 hover:bg-surface-raised/50 transition ${i % 2 === 0 ? '' : 'bg-surface-overlay/20'}`}>
                          <Td className="font-medium text-zinc-200">{d.name}</Td>
                          <Td className="text-zinc-500">{d.description ?? '—'}</Td>
                          <Td className="text-zinc-600 text-xs">{new Date(d.createdAt).toLocaleDateString()}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ Agents ══ */}
          {tab === 'agents' && (
            <motion.div key="agents" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
              {loadingAgents ? (
                <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-12 rounded-lg bg-surface-raised animate-pulse" />)}</div>
              ) : agents.length === 0 ? (
                <Empty message="No agents deployed." action="Deploy Agents" onAction={() => setTab('deploy')} />
              ) : (
                <div className="rounded-xl border border-surface-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-surface-border bg-surface-raised">
                        <Th>Name</Th><Th>Type</Th><Th>Model</Th><Th>Status</Th><Th>Created</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {agents.map((a, i) => (
                        <tr key={a.id} className={`border-b border-surface-border/50 hover:bg-surface-raised/50 transition ${i % 2 === 0 ? '' : 'bg-surface-overlay/20'}`}>
                          <Td className="font-medium text-zinc-200">{a.name}</Td>
                          <Td>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${AGENT_TYPE_BADGE[a.type] ?? 'bg-zinc-800 text-zinc-400'}`}>
                              {a.type}
                            </span>
                          </Td>
                          <Td className="text-zinc-400 text-xs font-mono">{a.model}</Td>
                          <Td className="text-zinc-400 text-xs capitalize">{a.status}</Td>
                          <Td className="text-zinc-600 text-xs">{new Date(a.createdAt).toLocaleDateString()}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {/* ══ Deploy ══ */}
          {tab === 'deploy' && (
            <motion.div key="deploy" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 lg:grid-cols-2 gap-6"
            >

              {/* ── Flow 1: Deploy Org Structure ── */}
              <DeployCard title="Deploy Org Structure" subtitle="Instantly create all departments for this tenant from a pre-built blueprint.">
                {deptDeployResult ? (
                  <SuccessBox>
                    Created <strong>{deptDeployResult.departments}</strong> departments
                    {deptDeployResult.agents > 0 && <> and <strong>{deptDeployResult.agents}</strong> agents</>}.
                    <button onClick={() => { setDeptDeployResult(null); setSelectedDeptTmpl(''); }}
                      className="mt-3 text-xs text-indigo-400 hover:underline block">
                      Deploy another →
                    </button>
                  </SuccessBox>
                ) : (
                  <>
                    <div className="mb-3">
                      <label className="text-xs text-zinc-500 mb-1.5 block">Select Template</label>
                      <select value={selectedDeptTmpl} onChange={(e) => setSelectedDeptTmpl(e.target.value)}
                        className="w-full rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">— choose a template —</option>
                        {deptTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.structure.length} depts)
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Structure preview */}
                    {selectedDeptTmpl && (() => {
                      const tmpl = deptTemplates.find((t) => t.id === selectedDeptTmpl);
                      return tmpl ? (
                        <div className="rounded-lg bg-surface-overlay border border-surface-border/50 p-2.5 mb-3 space-y-1 max-h-28 overflow-y-auto">
                          {tmpl.structure.map((item, i) => (
                            <div key={i} className="flex items-center gap-1.5 text-xs">
                              <span className="text-zinc-600">{item.parentName ? ' └' : '◆'}</span>
                              <span className="text-zinc-300">{item.name}</span>
                              {item.headAgentType && <span className="text-zinc-600 text-[10px]">({item.headAgentType})</span>}
                            </div>
                          ))}
                        </div>
                      ) : null;
                    })()}

                    <label className="flex items-center gap-3 cursor-pointer mb-4">
                      <div onClick={() => setWithAgents((v) => !v)}
                        className={`relative w-9 h-5 rounded-full transition cursor-pointer ${withAgents ? 'bg-indigo-600' : 'bg-zinc-700'}`}>
                        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${withAgents ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </div>
                      <span className="text-sm text-zinc-300">Auto-create head agents</span>
                    </label>

                    {deptDeployError && <ErrorBox>{deptDeployError}</ErrorBox>}

                    <button onClick={handleDeployDeptTemplate} disabled={!selectedDeptTmpl || deployingDept}
                      className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50"
                    >
                      {deployingDept ? 'Deploying…' : 'Deploy Structure'}
                    </button>
                  </>
                )}
              </DeployCard>

              {/* ── Flow 2: Deploy Agents ── */}
              <DeployCard title="Deploy Agents" subtitle="Pick agent templates, configure each one, then bulk-deploy to this tenant.">
                {agentDeployResult !== null ? (
                  <SuccessBox>
                    <strong>{agentDeployResult}</strong> agent{agentDeployResult !== 1 ? 's' : ''} deployed.
                    <button onClick={() => setAgentDeployResult(null)}
                      className="mt-3 text-xs text-indigo-400 hover:underline block">
                      Deploy more →
                    </button>
                  </SuccessBox>
                ) : (
                  <>
                    {/* Add agent from template */}
                    <div className="flex gap-2 mb-3">
                      <select value={addTemplateId} onChange={(e) => setAddTemplateId(e.target.value)}
                        className="flex-1 rounded-lg border border-surface-border bg-surface-overlay px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500"
                      >
                        <option value="">— pick template to add —</option>
                        {agentTemplateList.map((t) => (
                          <option key={t.id} value={t.id}>[{t.type}] {t.name}</option>
                        ))}
                      </select>
                      <button onClick={addAgentRow} disabled={!addTemplateId}
                        className="px-4 py-2 rounded-lg bg-surface-raised border border-surface-border text-sm text-zinc-300 hover:text-indigo-300 hover:border-indigo-700 transition disabled:opacity-40"
                      >
                        + Add
                      </button>
                    </div>

                    {/* Agent rows */}
                    {agentRows.length > 0 && (
                      <div className="space-y-2 mb-3 max-h-64 overflow-y-auto">
                        {agentRows.map((row, i) => {
                          const tmpl = agentTemplateList.find((t) => t.id === row.templateId);
                          return (
                            <div key={i} className="rounded-lg border border-surface-border bg-surface-overlay p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${AGENT_TYPE_BADGE[tmpl?.type ?? ''] ?? 'bg-zinc-800 text-zinc-400'}`}>
                                  {tmpl?.type ?? 'AGENT'}
                                </span>
                                <button onClick={() => removeAgentRow(i)} className="text-zinc-600 hover:text-red-400 transition text-xs">✕</button>
                              </div>
                              <input value={row.name}
                                onChange={(e) => updateAgentRow(i, { name: e.target.value })}
                                className="w-full rounded border border-surface-border bg-surface text-zinc-200 text-sm px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                placeholder="Agent display name"
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <label className="text-[10px] text-zinc-600 mb-0.5 block">Daily Budget ($)</label>
                                  <input type="number" value={row.budgetPerDay ?? 100}
                                    onChange={(e) => updateAgentRow(i, { budgetPerDay: Number(e.target.value) })}
                                    className="w-full rounded border border-surface-border bg-surface text-zinc-300 text-sm px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] text-zinc-600 mb-0.5 block">Authority</label>
                                  <select value={row.authorityLevel ?? 'RECOMMEND'}
                                    onChange={(e) => updateAgentRow(i, { authorityLevel: e.target.value as BulkAgentDeployItem['authorityLevel'] })}
                                    className="w-full rounded border border-surface-border bg-surface text-zinc-300 text-sm px-2 py-1.5 focus:outline-none focus:border-indigo-500"
                                  >
                                    <option value="AUTO">AUTO</option>
                                    <option value="RECOMMEND">RECOMMEND</option>
                                    <option value="APPROVAL">APPROVAL</option>
                                  </select>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {agentRows.length === 0 && (
                      <div className="py-6 text-center text-xs text-zinc-600">
                        Add agents using the picker above.
                      </div>
                    )}

                    {agentDeployError && <ErrorBox>{agentDeployError}</ErrorBox>}

                    <button onClick={handleBulkDeploy} disabled={agentRows.length === 0 || deployingAgents}
                      className="w-full py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition disabled:opacity-50 mt-2"
                    >
                      {deployingAgents ? 'Deploying…' : `Deploy ${agentRows.length || ''} Agent${agentRows.length !== 1 ? 's' : ''}`}
                    </button>
                  </>
                )}
              </DeployCard>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AdminShell>
  );
}

// ─── Small components ─────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="text-sm font-medium text-zinc-200">{value}</div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-4">
      <div className="text-xs text-zinc-500 mb-1">{label}</div>
      <div className="text-lg font-semibold text-zinc-100 truncate">{value}</div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left px-4 py-2.5 text-xs text-zinc-500 font-medium">{children}</th>;
}

function Td({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <td className={`px-4 py-3 ${className}`}>{children}</td>;
}

function Empty({ message, action, onAction }: { message: string; action: string; onAction: () => void }) {
  return (
    <div className="py-16 text-center text-zinc-500 text-sm">
      {message}{' '}
      <button onClick={onAction} className="text-indigo-400 hover:underline">{action}</button>
    </div>
  );
}

function DeployCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-surface-border bg-surface-raised p-5 flex flex-col gap-1">
      <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
      <p className="text-xs text-zinc-500 mb-4">{subtitle}</p>
      {children}
    </div>
  );
}

function SuccessBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-green-950 border border-green-800 px-4 py-5 text-sm text-green-300 text-center">
      <div className="text-2xl mb-2">✓</div>
      {children}
    </div>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-red-950 border border-red-800 px-3 py-2 text-sm text-red-300 mb-3">{children}</div>
  );
}
