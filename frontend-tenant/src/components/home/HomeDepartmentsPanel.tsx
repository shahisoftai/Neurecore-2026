'use client';

// HomeDepartmentsPanel — Creatio-style "Your Departments" 2-column card grid.
//
// Each card mirrors the Creatio reference image: icon left, dept name, agent
// count, optional status pill. Tapping a card navigates to the department
// workspace. The empty state encourages first-time setup via a CTA button.

import { useRouter } from 'next/navigation';
import { Building2, Users, RefreshCw, Lock } from 'lucide-react';
import { Department } from '@/stores/departmentStore';

interface HomeDepartmentsPanelProps {
  departments: Department[];
  agentCountByDept: Map<string, number>;
  onRefresh?: () => void;
}

export function HomeDepartmentsPanel({ departments, agentCountByDept, onRefresh }: HomeDepartmentsPanelProps) {
  const router = useRouter();
  // Defensive coercion (zustand persist can hydrate non-array values briefly).
  const safeDepartments = Array.isArray(departments) ? departments : [];

  return (
    <section aria-label="Your departments" className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-100 flex items-center gap-2">
          <Lock className="w-4 h-4 text-zinc-400" aria-hidden />
          Your Departments
        </h2>
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            className="text-xs text-zinc-500 hover:text-accent-500 transition flex items-center gap-1"
          >
            <RefreshCw className="w-3 h-3" aria-hidden />
            Refresh
          </button>
        )}
      </div>

      {safeDepartments.length === 0 ? (
        <div className="card-surface px-6 py-12 text-center">
          <p className="text-sm text-zinc-500">
            No departments yet. Create one to get started.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {safeDepartments.map((dept) => {
            const count = agentCountByDept.get(dept.id) ?? 0;
            const status = (dept as { status?: string }).status ?? 'ACTIVE';
            return (
              <button
                key={dept.id}
                type="button"
                onClick={() => router.push(`/departments/${encodeURIComponent(dept.id)}/workspace`)}
                className="card-surface card-interactive p-4 flex items-start gap-3 text-left"
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-accent-500/15 text-accent-500 shrink-0">
                  <Building2 className="w-5 h-5" aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-100 truncate">
                    {dept.name}
                  </p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5">
                    {status === 'ACTIVE' ? 'Active' : status}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs text-zinc-400">
                      <Users className="w-3 h-3" aria-hidden />
                      {count} agent{count === 1 ? '' : 's'}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
