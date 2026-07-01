// ─────────────────────────────────────────────────────────────
// AgentEvaluator — Reflection & quality scoring (ISP / DIP)
// ─────────────────────────────────────────────────────────────

export interface EvaluationInput {
  agentId: string;
  taskId: string;
  goal: string;
  steps: Array<{
    id: string;
    description: string;
    output?: unknown;
    success: boolean;
  }>;
  finalOutput?: unknown;
}

export interface EvaluationResult {
  score: number; // 0–1
  success: boolean;
  reflection: string;
  suggestions: string[];
  shouldRetry: boolean;
}

export interface IAgentEvaluator {
  evaluate(input: EvaluationInput): Promise<EvaluationResult>;
}

export const AGENT_EVALUATOR = Symbol('AGENT_EVALUATOR');
