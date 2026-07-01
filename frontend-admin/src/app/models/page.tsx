'use client';

import { useState, useEffect } from 'react';
import AdminShell from '@/components/AdminShell';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import api from '@/services/api';
import { unwrapArrayOrEmpty, unwrapItem } from '@/services/unwrap';

interface AIModel {
  id: string;
  name: string;
  provider: string;
  contextWindow?: number;
  costPer1kTokensInput?: number;
  costPer1kTokensOutput?: number;
  maxOutputTokens?: number;
  isAvailable?: boolean;
  capabilities?: string[];
  description?: string;
}

function toNumberOrNull(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function formatIntOrDash(v: unknown): string {
  const n = toNumberOrNull(v);
  return n === null ? '—' : Math.round(n).toLocaleString();
}

function formatCostOrDash(v: unknown): string {
  const n = toNumberOrNull(v);
  return n === null ? '—' : n.toFixed(3);
}

function formatContextWindowOrDash(v: unknown): string {
  const n = toNumberOrNull(v);
  return n === null ? '—' : `${(n / 1000).toFixed(0)}K`;
}

interface SelectRequest {
  taskType: string;
  complexity: 'low' | 'medium' | 'high';
  maxBudgetPerCall?: number;
  requiresSpeed?: boolean;
}

export default function AdminModelsPage() {
  const user = useAdminAuth();
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectForm, setSelectForm] = useState<SelectRequest>({ taskType: 'general', complexity: 'medium' });
  const [selectResult, setSelectResult] = useState<AIModel | null>(null);
  const [selecting, setSelecting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await api.get('/models/available');
        const raw = unwrapArrayOrEmpty(res) as unknown[];
        setModels(
          raw.map((m) => {
            const model = (m ?? {}) as Record<string, unknown>;
            return {
              id: String(model.id ?? ''),
              name: String(model.name ?? 'Unknown'),
              provider: String(model.provider ?? 'Unknown'),
              contextWindow: toNumberOrNull(model.contextWindow) ?? undefined,
              costPer1kTokensInput:
                toNumberOrNull(model.costPer1kTokensInput) ?? undefined,
              costPer1kTokensOutput:
                toNumberOrNull(model.costPer1kTokensOutput) ?? undefined,
              maxOutputTokens: toNumberOrNull(model.maxOutputTokens) ?? undefined,
              isAvailable:
                typeof model.isAvailable === 'boolean'
                  ? model.isAvailable
                  : undefined,
              capabilities: Array.isArray(model.capabilities)
                ? (model.capabilities as unknown[]).map(String)
                : [],
              description:
                typeof model.description === 'string'
                  ? model.description
                  : undefined,
            } satisfies AIModel;
          }),
        );
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    void load();
  }, []);

  const handleSelect = async () => {
    setSelecting(true);
    setSelectResult(null);
    try {
      const res = await api.post('/models/select', selectForm);
      setSelectResult(unwrapItem(res));
    } catch (err) {
      console.error(err);
    } finally {
      setSelecting(false);
    }
  };

  if (!user) return null;

  return (
    <AdminShell user={user}>
      <div className="max-w-7xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">AI Models</h1>
          <p className="text-sm text-gray-500 mt-1">Available models and intelligent routing</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Model Cards */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Available Models</h2>
            {loading ? (
              <div className="py-10 text-center text-gray-500">Loading models…</div>
            ) : (
              models.map((m) => (
                <div key={m.id} className="rounded-xl border border-gray-800 bg-gray-900 p-5">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-200">{m.name}</h3>
                        {!!m.isAvailable
                          ? <span className="px-1.5 py-0.5 bg-emerald-900 text-emerald-300 text-xs rounded">Available</span>
                          : <span className="px-1.5 py-0.5 bg-gray-700 text-gray-500 text-xs rounded">Unavailable</span>
                        }
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{m.provider} · {formatContextWindowOrDash(m.contextWindow)} context window</p>
                    </div>
                    <div className="text-right text-xs text-gray-500">
                      <div>In: ${formatCostOrDash(m.costPer1kTokensInput)}/1K</div>
                      <div>Out: ${formatCostOrDash(m.costPer1kTokensOutput)}/1K</div>
                    </div>
                  </div>
                  {m.description && <p className="text-xs text-gray-400 mt-2">{m.description}</p>}
                  {Array.isArray(m.capabilities) && m.capabilities.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {m.capabilities.map((c) => (
                        <span key={c} className="px-2 py-0.5 bg-gray-800 text-gray-400 text-xs rounded-full">{c}</span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 grid grid-cols-2 gap-3 text-xs text-gray-500">
                    <div>Max output: <span className="text-gray-300">{formatIntOrDash(m.maxOutputTokens)} tokens</span></div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Model Router Tester */}
          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Model Router</h2>
            <div className="rounded-xl border border-gray-800 bg-gray-900 p-5 space-y-4">
              <p className="text-xs text-gray-400">Test the intelligent model selection algorithm</p>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Task Type</label>
                <input
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  value={selectForm.taskType}
                  onChange={(e) => setSelectForm({ ...selectForm, taskType: e.target.value })}
                  placeholder="general, code, analysis…"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Complexity</label>
                <select
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  value={selectForm.complexity}
                  onChange={(e) => setSelectForm({ ...selectForm, complexity: e.target.value as 'low' | 'medium' | 'high' })}
                >
                  {['low', 'medium', 'high'].map((v) => (
                    <option key={v} value={v}>{v.charAt(0).toUpperCase() + v.slice(1)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Max Budget/Call (USD)</label>
                <input
                  type="number"
                  step="0.001"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-600"
                  value={selectForm.maxBudgetPerCall ?? ''}
                  onChange={(e) => setSelectForm({ ...selectForm, maxBudgetPerCall: e.target.value ? parseFloat(e.target.value) : undefined })}
                  placeholder="0.10"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="speed"
                  checked={!!selectForm.requiresSpeed}
                  onChange={(e) => setSelectForm({ ...selectForm, requiresSpeed: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="speed" className="text-xs text-gray-400">Requires fast response</label>
              </div>
              <button
                onClick={handleSelect}
                disabled={selecting}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
              >
                {selecting ? 'Selecting…' : 'Select Best Model'}
              </button>

              {selectResult && (
                <div className="rounded-lg bg-indigo-950 border border-indigo-800 p-4 text-sm">
                  <p className="text-xs text-indigo-400 mb-2 font-semibold uppercase tracking-wider">Recommended</p>
                  <p className="font-semibold text-indigo-200">{selectResult.name}</p>
                  <p className="text-xs text-indigo-400 mt-0.5">{selectResult.provider}</p>
                  <div className="mt-2 text-xs text-indigo-300 space-y-0.5">
                    <div>Context: {formatContextWindowOrDash(selectResult.contextWindow)} tokens</div>
                    <div>Cost: ${formatCostOrDash(selectResult.costPer1kTokensInput)}/${formatCostOrDash(selectResult.costPer1kTokensOutput)} per 1K</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
