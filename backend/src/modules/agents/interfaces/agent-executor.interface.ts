import type { PlanStep } from './agent-planner.interface';

// ─────────────────────────────────────────────────────────────
// Execution types
// ─────────────────────────────────────────────────────────────

export interface StepResult {
  stepId: string;
  success: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  tokensUsed?: number;
  costUsd?: number;
}

export interface ExecutionResult {
  taskId: string;
  agentId: string;
  success: boolean;
  steps: StepResult[];
  finalOutput?: unknown;
  error?: string;
  totalDurationMs: number;
  totalTokensUsed: number;
  totalCostUsd: number;
}

export interface ExecutionContext {
  taskId: string;
  agentId: string;
  tenantId: string;
  step: PlanStep;
  availableTools: string[];
  previousResults?: Map<string, StepResult>;
}

// ─────────────────────────────────────────────────────────────
// Interface: IAgentExecutor  (SOLID ISP / DIP)
// ─────────────────────────────────────────────────────────────

export interface IAgentExecutor {
  execute(context: ExecutionContext): Promise<StepResult>;
  executeTask(
    taskId: string,
    agentId: string,
    tenantId: string,
  ): Promise<ExecutionResult>;
  cancelTask(taskId: string): Promise<void>;
}

export const AGENT_EXECUTOR = Symbol('AGENT_EXECUTOR');
