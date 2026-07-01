// ─────────────────────────────────────────────────────────────
// Plan types
// ─────────────────────────────────────────────────────────────

export interface PlanStep {
  id: string;
  description: string;
  toolId?: string;
  input?: Record<string, unknown>;
  dependsOn?: string[]; // step IDs
}

export interface AgentPlan {
  goal: string;
  steps: PlanStep[];
  estimatedTokens?: number;
}

export interface PlanningContext {
  agentId: string;
  goal: string;
  availableTools: string[];
  conversationHistory?: Array<{ role: string; content: string }>;
  constraints?: string[];
}

// ─────────────────────────────────────────────────────────────
// Interface: IAgentPlanner  (SOLID ISP / DIP)
// ─────────────────────────────────────────────────────────────

export interface IAgentPlanner {
  plan(context: PlanningContext): Promise<AgentPlan>;
  replan(
    plan: AgentPlan,
    failedStepId: string,
    error: string,
  ): Promise<AgentPlan>;
}

export const AGENT_PLANNER = Symbol('AGENT_PLANNER');
