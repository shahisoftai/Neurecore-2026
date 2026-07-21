'use client';
// ─── OrgTree ──────────────────────────────────────────────────────────────────
// S — Single Responsibility: renders hierarchical Dept → Agent sidebar tree only
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { useInspectorStore } from '@/stores/inspectorStore';
import { departmentRepository } from '@/core/repositories/DepartmentRepository';
import { agentRepository } from '@/core/repositories/AgentRepository';
import type { Agent } from '@/shared/types/domain.types';

interface DeptNode {
  id: string;
  name: string;
  agents: Agent[];
}

const STATUS_DOT: Record<string, string> = {
  RUNNING:    'bg-status-ops',
  ACTIVE:     'bg-status-profit',
  IDLE:       'bg-zinc-600',
  ERROR:      'bg-status-risk',
  PAUSED:     'bg-status-warn',
  INACTIVE:   'bg-zinc-600',
  TRAINING:   'bg-amber-400',
  TERMINATED: 'bg-zinc-600',
};

export function OrgTree() {
  const [depts, setDepts] = useState<DeptNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const { openInspector } = useInspectorStore();
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ items: deptList }, { items: agentList }] = await Promise.all([
          departmentRepository.findAll({ limit: 100 }),
          agentRepository.findAll({ limit: 200 }),
        ]);
        if (cancelled) return;
        const tree: DeptNode[] = deptList.map((d) => ({
          id: d.id,
          name: d.name,
          agents: agentList.filter((a) => a.departmentId === d.id),
        }));
        const unassigned = agentList.filter((a) => !a.departmentId);
        if (unassigned.length > 0) {
          tree.push({ id: '__unassigned', name: 'Unassigned', agents: unassigned });
        }
        setDepts(tree);
        if (tree[0]) setExpanded(new Set([tree[0].id]));
      } catch {
        // silently fail — sidebar tree is non-critical
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });

  return (
    <div className="flex flex-col gap-0.5 px-2">
      {depts.map((dept) => (
        <div key={dept.id}>
          <button
            onClick={() => toggle(dept.id)}
            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 hover:bg-surface-raised transition-colors"
          >
            <span className={`transition-transform text-[10px] ${expanded.has(dept.id) ? 'rotate-90' : ''}`}>▶</span>
            <span className="truncate flex-1 text-left">{dept.name}</span>
            <span className="text-[10px] text-zinc-600">{dept.agents.length}</span>
          </button>

          <AnimatePresence initial={false}>
            {expanded.has(dept.id) && dept.agents.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="overflow-hidden"
              >
                <div className="ml-4 border-l border-surface-border pl-2 flex flex-col gap-0.5 py-0.5">
                  {dept.agents.map((agent) => (
                    <button
                      key={agent.id}
                      onClick={() => openInspector('agent', agent.id)}
                      className={`flex items-center gap-2 px-2 py-1 rounded-lg text-xs text-zinc-500 hover:text-zinc-200 hover:bg-surface-raised transition-colors text-left ${
                        pathname?.includes(agent.id) ? 'bg-surface-raised text-zinc-200' : ''
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${STATUS_DOT[agent.status] ?? 'bg-zinc-600'}`} />
                      <span className="truncate">{agent.name}</span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}
    </div>
  );
}
