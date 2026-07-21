'use client';
// ─── useOrgChart.ts ───────────────────────────────────────────────────────────
// SRP: Org chart data orchestration — fetch, tree build, search, DnD state.
// DIP: Depends on repository abstractions via stores.

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useDepartmentStore } from '@/stores/departmentStore';
import { useAgentStore }      from '@/stores/agentStore';
import type { Department, Agent } from '@/shared/types/domain.types';

export type OrgNodeType = 'tenant' | 'department' | 'agent';

export interface OrgNode {
  type:         OrgNodeType;
  id:           string;
  name:         string;
  parentId?:    string;
  status?:      string;
  mood?:        string;
  avatarUrl?:   string | null;
  workloadGauge?: number;
  children?:    OrgNode[];
  _dept?:       Department;
  _agent?:      Agent;
  /** Only for tenant type */
  departmentCount?: number;
  agentCount?:    number;
}

interface UseOrgChartReturn {
  /** Flat list of root departments (with agents as children) — for sidebar/drag-drop */
  tree:           OrgNode[];
  /** Tenant-rooted single tree node — for OrgChartView */
  tenantTree:     OrgNode;
  filteredTree:  OrgNode[];
  query:         string;
  selectedId:     string | null;
  draggingId:    string | null;
  isLoading:     boolean;
  setQuery:      (q: string) => void;
  select:        (id: string | null) => void;
  setDragging:   (id: string | null) => void;
  moveAgent:     (agentId: string, toDeptId: string) => Promise<void>;
  expandedDepts: Set<string>;
  toggleDept:    (id: string) => void;
}

function buildHierarchy(departments: Department[], agents: Agent[]): OrgNode[] {
  const agentMap = new Map<string, Agent[]>();
  for (const a of agents) {
    if (!a.departmentId) continue;
    if (!agentMap.has(a.departmentId)) agentMap.set(a.departmentId, []);
    agentMap.get(a.departmentId)!.push(a);
  }

  const deptMap = new Map<string, OrgNode>();
  const roots: OrgNode[] = [];

  for (const d of departments) {
    const node: OrgNode = {
      type:    'department',
      id:      d.id,
      name:    d.name,
      parentId: d.parentId ?? undefined,
      _dept:   d,
      children: (agentMap.get(d.id) ?? []).map((a): OrgNode => ({
        type:          'agent',
        id:            a.id,
        name:          a.name,
        parentId:      d.id,
        status:        a.status,
        mood:          a.mood,
        avatarUrl:     a.avatarUrl,
        workloadGauge: a.workloadGauge,
        _agent:        a,
      })),
    };
    deptMap.set(d.id, node);
  }

  for (const d of departments) {
    const node = deptMap.get(d.id)!;
    if (d.parentId && deptMap.has(d.parentId)) {
      deptMap.get(d.parentId)!.children!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function buildTenantTree(
  roots: OrgNode[],
  tenantName: string,
): OrgNode {
  const totalDepts = roots.length;
  const totalAgents = roots.reduce(
    (sum, r) => sum + (r.children?.length ?? 0),
    0,
  );

  return {
    type:            'tenant',
    id:              '__tenant__',
    name:            tenantName,
    children:        roots,
    departmentCount: totalDepts,
    agentCount:      totalAgents,
  };
}

function nodeMatchesQuery(node: OrgNode, q: string): boolean {
  const lower = q.toLowerCase();
  return (
    node.name.toLowerCase().includes(lower) ||
    (node._agent?.type?.toLowerCase().includes(lower) ?? false) ||
    (node._dept?.description?.toLowerCase().includes(lower) ?? false)
  );
}

function filterTree(tree: OrgNode[], q: string): OrgNode[] {
  if (!q.trim()) return tree;
  return tree
    .map((dept) => ({
      ...dept,
      children: dept.children?.filter((child) => nodeMatchesQuery(child, q)),
    }))
    .filter((dept) => nodeMatchesQuery(dept, q) || (dept.children?.length ?? 0) > 0);
}

export function useOrgChart(): UseOrgChartReturn {
  const {
    departments: departmentsRaw,
    loading: deptLoading,
    fetchDepartments,
  } = useDepartmentStore();

  const {
    agents: agentsRaw,
    loading: agentLoading,
    fetchAgents,
  } = useAgentStore();

  const departments = Array.isArray(departmentsRaw) ? departmentsRaw : [];
  const agents = Array.isArray(agentsRaw) ? agentsRaw : [];

  const [query, setQuery]           = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, _setDragging]  = useState<string | null>(null);
  const [expandedDepts, setExpanded] = useState<Set<string>>(new Set());
  // Local agent positions (overrides until next fetch)
  const [overrides, setOverrides]   = useState<Record<string, string>>({});

  useEffect(() => {
    fetchDepartments();
    fetchAgents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const agentsWithOverrides = useMemo(
    () => agents.map((a) => overrides[a.id] ? { ...a, departmentId: overrides[a.id] } : a),
    [agents, overrides],
  );

  const hierarchy = useMemo(
    () => buildHierarchy(departments, agentsWithOverrides),
    [departments, agentsWithOverrides],
  );

  const tree = hierarchy; // flat list for OrgChartSidebar backward compat

  const tenantTree = useMemo(
    () => buildTenantTree(hierarchy, 'Organization'),
    [hierarchy],
  );

  const filteredTree = useMemo(
    () => filterTree(hierarchy, query),
    [hierarchy, query],
  );

  const toggleDept = useCallback((id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const moveAgent = useCallback(async (agentId: string, toDeptId: string) => {
    setOverrides((prev) => ({ ...prev, [agentId]: toDeptId }));
    setExpanded((prev) => new Set([...prev, toDeptId]));
    try {
      await useAgentStore.getState().moveAgent(agentId, toDeptId);
    } catch {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[agentId];
        return next;
      });
    }
  }, []);

  return {
    tree,
    tenantTree,
    filteredTree,
    query,
    selectedId,
    draggingId,
    isLoading: deptLoading || agentLoading,
    setQuery,
    select: setSelectedId,
    setDragging: _setDragging,
    moveAgent,
    expandedDepts,
    toggleDept,
  };
}
