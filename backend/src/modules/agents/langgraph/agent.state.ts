/**
 * Agent State Machine for LangGraph-style Agent Execution
 *
 * This is a custom implementation that follows LangGraph principles.
 * Can be migrated to @langchain/langgraph when installed.
 *
 * Architecture:
 * - Nodes: planner, executor, evaluator, tool_node, finish
 * - Edges: Conditional routing based on state
 */

import { z } from 'zod';

/**
 * Step execution result
 */
export const StepResultSchema = z.object({
  id: z.string(),
  description: z.string(),
  toolName: z.string().optional(),
  input: z.record(z.unknown()).optional(),
  output: z.unknown().optional(),
  error: z.string().optional(),
  success: z.boolean(),
  durationMs: z.number(),
  tokensUsed: z.number().optional(),
  costUsd: z.number().optional(),
});

export type StepResult = z.infer<typeof StepResultSchema>;

/**
 * Tool call definition
 */
export const ToolCallSchema = z.object({
  name: z.string(),
  input: z.record(z.unknown()),
  reasoning: z.string().optional(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;

/**
 * Agent state - represents the complete state of the agent at any point
 */
export interface AgentState {
  // Core fields
  goal: string;
  agentId: string;
  tenantId: string;
  userId?: string;

  // Plan fields
  plan?: {
    steps: Array<{
      id: string;
      description: string;
      toolId: string | null;
      input: Record<string, unknown>;
      dependsOn: string[];
    }>;
    currentStepIndex: number;
  };

  // Execution fields
  steps: StepResult[];
  currentStep?: {
    id: string;
    description: string;
    toolId: string | null;
    input: Record<string, unknown>;
  };

  // Tool execution
  toolCalls: ToolCall[];
  toolResults: Array<{
    toolName: string;
    input: unknown;
    output: unknown;
    error?: string;
    durationMs: number;
  }>;

  // Evaluation
  evaluation?: {
    score: number;
    success: boolean;
    reflection: string;
    suggestions: string[];
    shouldRetry: boolean;
  };

  // Conversation memory
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
  }>;

  // Control fields
  iterations: number;
  maxIterations: number;
  error: string | null;
  shouldContinue: boolean;
  currentNode: AgentNode;

  // Tool allowlist (Phase 1.4 / 4.1 of remediation plan).
  // null  ⇒ unrestricted (legacy chat path)
  // []    ⇒ deny-all
  // [...names] ⇒ whitelist enforced by both plannerNode and toolNode
  allowedTools?: string[] | null;
}

/**
 * Agent nodes - represent the different stages of execution
 */
export type AgentNode =
  | 'planner' // Plan the task
  | 'executor' // Execute the current step
  | 'tool_node' // Execute tool calls
  | 'evaluator' // Evaluate the execution
  | 'finish'; // Complete execution

/**
 * Agent update - partial state updates
 */
export type AgentUpdate = Partial<AgentState>;

/**
 * Node function signature
 */
export type AgentNodeFunction = (state: AgentState) => Promise<AgentUpdate>;

/**
 * Edge function - determines next node
 */
export type AgentEdgeFunction = (state: AgentState) => AgentNode;

/**
 * Conditional edge - maps node to next node based on condition
 */
export interface ConditionalEdge {
  condition: (state: AgentState) => boolean;
  targetNode: AgentNode;
}

/**
 * Create initial agent state
 */
export function createInitialState(params: {
  goal: string;
  agentId: string;
  tenantId: string;
  userId?: string;
  maxIterations?: number;
}): AgentState {
  return {
    goal: params.goal,
    agentId: params.agentId,
    tenantId: params.tenantId,
    userId: params.userId,
    steps: [],
    toolCalls: [],
    toolResults: [],
    messages: [
      {
        role: 'user',
        content: params.goal,
        timestamp: Date.now(),
      },
    ],
    iterations: 0,
    maxIterations: params.maxIterations ?? 10,
    error: null,
    shouldContinue: true,
    currentNode: 'planner',
  };
}

/**
 * Check if agent should continue
 */
export function shouldContinue(state: AgentState): boolean {
  return (
    state.shouldContinue &&
    state.iterations < state.maxIterations &&
    state.error === null
  );
}

/**
 * Check if plan exists and has more steps
 */
export function hasMoreSteps(state: AgentState): boolean {
  if (!state.plan) return false;
  return state.plan.currentStepIndex < state.plan.steps.length;
}

/**
 * Check if current step is a tool call
 */
export function isToolCall(state: AgentState): boolean {
  return (
    state.currentStep?.toolId !== null &&
    state.currentStep?.toolId !== undefined
  );
}

/**
 * Check if evaluation passed
 */
export function evaluationPassed(state: AgentState): boolean {
  if (!state.evaluation) return false;
  return state.evaluation.success && state.evaluation.score >= 0.8;
}
