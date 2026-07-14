/**
 * Specialist AI employees registry + deterministic selector (Phase 5).
 * Specialists are REASONING-ONLY role profiles. None access capabilities or
 * execute tools. Selection is deterministic (rule-based on objective +
 * departments) so the same objective always convenes the same specialists.
 */

import { Injectable } from '@nestjs/common';
import type {
  EnterpriseObjective,
  IAgentSelector,
  SpecialistAgent,
} from '../contracts/enterprise-cognition.interface';

const SPECIALISTS: SpecialistAgent[] = [
  { role: 'Finance Analyst', department: 'finance', expertise: ['budget', 'cost', 'forecast'], reasoningScope: ['finance', 'projects'], maxAuthority: 70 },
  { role: 'Legal Advisor', department: 'legal', expertise: ['contract', 'compliance', 'risk'], reasoningScope: ['approvals', 'projects'], maxAuthority: 70 },
  { role: 'Marketing Strategist', department: 'marketing', expertise: ['campaign', 'brand', 'audience'], reasoningScope: ['projects', 'customers'], maxAuthority: 60 },
  { role: 'Project Manager', department: 'operations', expertise: ['timeline', 'stages', 'delivery'], reasoningScope: ['projects', 'tasks'], maxAuthority: 60 },
  { role: 'Sales Strategist', department: 'sales', expertise: ['pipeline', 'customer', 'opportunity'], reasoningScope: ['customers', 'projects'], maxAuthority: 60 },
  { role: 'Compliance Officer', department: 'compliance', expertise: ['policy', 'audit', 'governance'], reasoningScope: ['approvals', 'governance'], maxAuthority: 70 },
  { role: 'Risk Analyst', department: 'risk', expertise: ['risk', 'deadline', 'budget'], reasoningScope: ['projects', 'finance', 'tasks'], maxAuthority: 65 },
  { role: 'Operations Planner', department: 'operations', expertise: ['resource', 'capacity', 'workflow'], reasoningScope: ['tasks', 'projects'], maxAuthority: 60 },
  { role: 'Customer Success Advisor', department: 'customer-success', expertise: ['engagement', 'retention', 'communication'], reasoningScope: ['customers', 'comms'], maxAuthority: 55 },
  { role: 'Business Intelligence Analyst', department: 'strategy', expertise: ['metrics', 'trends', 'okr'], reasoningScope: ['projects', 'finance', 'memory'], maxAuthority: 60 },
];

@Injectable()
export class AgentSelector implements IAgentSelector {
  listAll(): SpecialistAgent[] {
    return SPECIALISTS.map((s) => ({ ...s }));
  }

  /** Deterministic selection: match specialist expertise/department against the
   *  objective statement + its departments + required capabilities. Always
   *  returns a stable, ordered set for a given objective. */
  select(objective: EnterpriseObjective): SpecialistAgent[] {
    const hay = [
      objective.statement,
      ...objective.departments,
      ...objective.requiredContextCapabilities,
      ...objective.expectedDeliverables,
    ]
      .join(' ')
      .toLowerCase();

    const scored = SPECIALISTS.map((s) => {
      let score = 0;
      if (objective.departments.map((d) => d.toLowerCase()).includes(s.department)) score += 5;
      for (const e of s.expertise) if (hay.includes(e)) score += 2;
      for (const cap of s.reasoningScope) if (objective.requiredContextCapabilities.includes(cap)) score += 1;
      return { s, score };
    })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.s.role.localeCompare(b.s.role));

    // Always include a Risk Analyst + Project Manager for enterprise coverage,
    // then top matches, capped for bounded coordination.
    const base = SPECIALISTS.filter((s) => ['Risk Analyst', 'Project Manager'].includes(s.role));
    const picked = new Map<string, SpecialistAgent>();
    for (const s of base) picked.set(s.role, s);
    for (const x of scored) { if (picked.size >= 6) break; picked.set(x.s.role, x.s); }
    return [...picked.values()].map((s) => ({ ...s }));
  }
}
