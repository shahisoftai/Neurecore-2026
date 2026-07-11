/**
 * Agent State Machine
 *
 * @deprecated Per ai-gateway-imp-plan.md §3.1 (S16/S17) and §8.3,
 * this file is the legacy state machine retained only for
 * `AI_GATEWAY_V2=false` rollback safety. The current implementation
 * lives in `langgraph-official.ts`. This file will be deleted after
 * a 24h soak of `AI_GATEWAY_V2=true` in production.
 *
 * When `AI_GATEWAY_V2=true`, the planner + evaluator nodes route
 * through `AiGatewayService` (capability=`planning` / `evaluation`)
 * instead of reading `OPENAI_API_KEY` and hardcoding `gpt-4o-mini`.
 */

import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AgentState,
  AgentNode,
  AgentUpdate,
  createInitialState,
  shouldContinue,
  hasMoreSteps,
  isToolCall,
  evaluationPassed,
} from './agent.state';
import { AgentStreamingService } from '../streaming/agent-streaming.service';
import { StructuredToolRegistry } from '../../tools/structured-tool.registry';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';

/**
 * Node functions
 */
type NodeFunction = (state: AgentState) => Promise<AgentUpdate>;

/**
 * Event emitter for state changes
 */
export type StateChangeCallback = (
  state: AgentState,
  node: AgentNode,
) => void | Promise<void>;

/**
 * Agent State Machine
 */
@Injectable()
export class AgentStateMachine {
  private readonly logger = new Logger(AgentStateMachine.name);

  constructor(
    private readonly config: ConfigService,
    private readonly streamingService: AgentStreamingService,
    private readonly toolRegistry: StructuredToolRegistry,
    @Optional() private readonly featureFlags?: FeatureFlagService,
    @Optional() private readonly aiGateway?: AiGatewayService,
  ) {}

  /**
   * Run the state machine
   */
  async run(params: {
    goal: string;
    agentId: string;
    tenantId: string;
    userId?: string;
    maxIterations?: number;
    sessionId?: string;
    onStateChange?: StateChangeCallback;
  }): Promise<AgentState> {
    const { goal, agentId, tenantId, userId, maxIterations, sessionId } =
      params;

    // Initialize state
    let state = createInitialState({
      goal,
      agentId,
      tenantId,
      userId,
      maxIterations,
    });

    this.logger.log(`Starting state machine for goal: ${goal}`);

    // Emit streaming events if session provided
    if (sessionId) {
      this.streamingService.emitStart(sessionId, agentId);
    }

    // Run the graph
    while (shouldContinue(state)) {
      const currentNode = state.currentNode;

      this.logger.debug(`Executing node: ${currentNode}`);

      // Emit step start for streaming
      if (sessionId && currentNode === 'executor') {
        this.streamingService.emitStepStart(
          sessionId,
          agentId,
          state.plan?.currentStepIndex ?? 0,
          state.plan?.steps.length ?? 0,
          state.currentStep ?? { id: 'unknown', description: 'Executing' },
        );
      }

      // Execute the current node
      const nodeFunction = this.getNodeFunction(currentNode);
      const updates = await nodeFunction(state);

      // Merge updates into state
      state = { ...state, ...updates };

      // Emit events
      if (sessionId) {
        this.emitNodeEvents(sessionId, agentId, state, currentNode);
      }

      // Notify callback
      if (params.onStateChange) {
        await params.onStateChange(state, currentNode);
      }

      // Determine next node
      const nextNode = this.route(state, currentNode);
      state = { ...state, currentNode: nextNode };

      // Check if should continue
      if (nextNode === 'finish' || !shouldContinue(state)) {
        break;
      }
    }

    this.logger.log(
      `State machine finished after ${state.iterations} iterations`,
    );

    if (sessionId) {
      this.streamingService.emitComplete(sessionId, agentId, {
        steps: state.steps,
        evaluation: state.evaluation,
        finalOutput: state.steps.at(-1)?.output,
      });
    }

    return state;
  }

  /**
   * Get the node function for a given node
   */
  private getNodeFunction(node: AgentNode): NodeFunction {
    switch (node) {
      case 'planner':
        return this.plannerNode.bind(this) as NodeFunction;
      case 'executor':
        return this.executorNode.bind(this) as NodeFunction;
      case 'tool_node':
        return this.toolNode.bind(this) as NodeFunction;
      case 'evaluator':
        return this.evaluatorNode.bind(this) as NodeFunction;
      case 'finish':
        return ((_state: AgentState) =>
          Promise.resolve({ shouldContinue: false })) as NodeFunction;
      default: {
        // This should never happen if all cases are covered
        const unknownNode = node as string;
        return ((_state: AgentState) =>
          Promise.resolve({
            error: `Unknown node: ${unknownNode}`,
          })) as NodeFunction;
      }
    }
  }

  /**
   * Route to next node based on current state
   */
  private route(state: AgentState, currentNode: AgentNode): AgentNode {
    switch (currentNode) {
      case 'planner':
        // After planning, check if we have a plan
        if (state.plan && state.plan.steps.length > 0) {
          return 'executor';
        }
        return 'finish';

      case 'executor':
        // After execution, decide next step
        if (isToolCall(state)) {
          return 'tool_node';
        }
        // Direct execution (no tool) - go to evaluator
        return 'evaluator';

      case 'tool_node':
        // After tool execution, go to evaluator
        return 'evaluator';

      case 'evaluator':
        // After evaluation, decide next action
        if (evaluationPassed(state)) {
          // Check if there are more steps
          if (hasMoreSteps(state)) {
            return 'executor';
          }
          return 'finish';
        }

        // Check if we should retry
        if (
          state.evaluation?.shouldRetry &&
          state.iterations < state.maxIterations
        ) {
          return 'executor';
        }

        return 'finish';

      default:
        return 'finish';
    }
  }

  /**
   * Planner node - creates a plan for the goal
   */
  private async plannerNode(state: AgentState): Promise<AgentUpdate> {
    this.logger.debug('Executing planner node');

    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      // Fallback to stub plan
      return {
        plan: {
          steps: [
            {
              id: 'step-1',
              description: `Execute goal: ${state.goal}`,
              toolId: null,
              input: {},
              dependsOn: [],
            },
          ],
          currentStepIndex: 0,
        },
        currentStep: undefined,
      };
    }

    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const { z } = await import('zod');

      // S16 (per ai-gateway-imp-plan.md): the model id is resolved by
      // the gateway when AI_GATEWAY_V2=true. When the flag is off we
      // fall back to the legacy 'gpt-4o-mini' default.
      const modelId = await this.resolveModelId('planning');
      const llm = new ChatOpenAI({
        apiKey,
        model: modelId,
        temperature: 0.2,
        maxTokens: 1024,
      });

      // Get available tools
      const tools = this.toolRegistry.getAll();
      const toolList = tools
        .map((t) => `${t.name}: ${t.description}`)
        .join('\n');

      // Define planning schema
      const planStepSchema = z.object({
        id: z.string(),
        description: z.string(),
        toolId: z.string().nullable(),
        input: z.record(z.unknown()),
        dependsOn: z.array(z.string()),
      });

      const planSchema = z.object({
        steps: z.array(planStepSchema),
        reasoning: z.string().optional(),
      });

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an AI task planner. Decompose the goal into ordered steps.
Available tools: ${toolList || 'none'}
Rules:
- Keep steps atomic — one action per step.
- dependsOn contains step IDs that must complete first.
- Produce 1-5 steps maximum.`,
        ],
        ['human', 'Goal: {goal}'],
      ]);

      const structuredLlm = llm.withStructuredOutput(planSchema);
      const chain = prompt.pipe(structuredLlm);

      const plan = await chain.invoke({ goal: state.goal });

      const steps = plan.steps.map((s, i) => ({
        id: s.id || `step-${i + 1}`,
        description: s.description,
        toolId: s.toolId ?? null,
        input: s.input ?? {},
        dependsOn: s.dependsOn ?? [],
      }));

      return {
        plan: {
          steps,
          currentStepIndex: 0,
        },
        currentStep: steps[0],
      };
    } catch (error) {
      this.logger.error('Planner node failed', error);
      return {
        error: `Planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        shouldContinue: false,
      };
    }
  }

  /**
   * Executor node - executes the current step
   */
  private executorNode(state: AgentState): Promise<AgentUpdate> {
    this.logger.debug('Executing executor node');

    if (!state.plan || !state.currentStep) {
      return Promise.resolve({ error: 'No plan or current step' });
    }

    const step = state.currentStep;
    const startTime = Date.now();

    try {
      // If step doesn't require a tool, execute directly
      if (!step.toolId) {
        // This would be for LLM-only reasoning steps
        return Promise.resolve({
          steps: [
            ...state.steps,
            {
              id: step.id,
              description: step.description,
              output: `Executed: ${step.description}`,
              success: true,
              durationMs: Date.now() - startTime,
            },
          ],
          plan: {
            ...state.plan,
            currentStepIndex: state.plan.currentStepIndex + 1,
          },
          currentStep: state.plan.steps[state.plan.currentStepIndex + 1],
        });
      }

      // Step requires a tool - will be handled by tool_node
      return Promise.resolve({});
    } catch (error) {
      return Promise.resolve({
        steps: [
          ...state.steps,
          {
            id: step.id,
            description: step.description,
            error: error instanceof Error ? error.message : 'Unknown error',
            success: false,
            durationMs: Date.now() - startTime,
          },
        ],
      });
    }
  }

  /**
   * Tool node - executes tool calls
   */
  private async toolNode(state: AgentState): Promise<AgentUpdate> {
    this.logger.debug('Executing tool node');

    if (!state.currentStep?.toolId) {
      return { error: 'No tool to execute' };
    }

    const toolName = state.currentStep.toolId;
    const toolInput = state.currentStep.input ?? {};
    const startTime = Date.now();

    try {
      const tool = this.toolRegistry.get(toolName);

      if (!tool) {
        throw new Error(`Tool '${toolName}' not found`);
      }

      const result = await this.toolRegistry.execute(toolName, toolInput, {
        tenantId: state.tenantId,
        userId: state.userId,
      });

      return {
        toolCalls: [
          ...state.toolCalls,
          {
            name: toolName,
            input: toolInput,
          },
        ],
        toolResults: [
          ...state.toolResults,
          {
            toolName,
            input: toolInput,
            output: result,
            durationMs: Date.now() - startTime,
          },
        ],
        steps: [
          ...state.steps,
          {
            id: state.currentStep.id,
            description: state.currentStep.description,
            toolName,
            input: toolInput,
            output: result,
            success: true,
            durationMs: Date.now() - startTime,
          },
        ],
        plan: state.plan
          ? {
              ...state.plan,
              currentStepIndex: state.plan.currentStepIndex + 1,
            }
          : undefined,
        currentStep: state.plan?.steps[state.plan.currentStepIndex + 1],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        steps: [
          ...state.steps,
          {
            id: state.currentStep.id,
            description: state.currentStep.description,
            toolName,
            input: toolInput,
            error: errorMessage,
            success: false,
            durationMs: Date.now() - startTime,
          },
        ],
        toolResults: [
          ...state.toolResults,
          {
            toolName,
            input: toolInput,
            output: undefined,
            error: errorMessage,
            durationMs: Date.now() - startTime,
          },
        ],
      };
    }
  }

  /**
   * Evaluator node - evaluates the execution
   */
  private async evaluatorNode(state: AgentState): Promise<AgentUpdate> {
    this.logger.debug('Executing evaluator node');

    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    // Get last step result
    const lastStep = state.steps[state.steps.length - 1];
    const successfulSteps = state.steps.filter((s) => s.success);
    const successRate =
      state.steps.length > 0 ? successfulSteps.length / state.steps.length : 0;

    if (!apiKey) {
      // Fallback to heuristic evaluation
      const passed = successRate >= 0.8;
      return {
        evaluation: {
          score: successRate,
          success: passed,
          reflection: `Heuristic: ${successfulSteps.length}/${state.steps.length} steps succeeded`,
          suggestions: successRate < 1 ? ['Some steps failed'] : [],
          shouldRetry: successRate < 0.5,
        },
        iterations: state.iterations + 1,
        shouldContinue: passed && hasMoreSteps(state),
      };
    }

    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const { z } = await import('zod');

      // S17: model id resolved by the gateway when AI_GATEWAY_V2=true.
      const modelId = await this.resolveModelId('evaluation');
      const llm = new ChatOpenAI({
        apiKey,
        model: modelId,
        temperature: 0,
        maxTokens: 512,
      });

      const evaluationSchema = z.object({
        score: z.number().min(0).max(1),
        success: z.boolean(),
        reflection: z.string(),
        suggestions: z.array(z.string()),
        shouldRetry: z.boolean(),
      });

      const stepSummary = state.steps
        .map((s) => `- ${s.description}: ${s.success ? '✓' : '✗'}`)
        .join('\n');

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          'Evaluate the task execution quality. Provide score, success, reflection, and suggestions.',
        ],
        [
          'human',
          `Goal: {goal}\n\nSteps:\n{steps}\n\nLast output: {lastOutput}`,
        ],
      ]);

      const structuredLlm = llm.withStructuredOutput(evaluationSchema);
      const chain = prompt.pipe(structuredLlm);

      const evaluation = await chain.invoke({
        goal: state.goal,
        steps: stepSummary,
        lastOutput: lastStep?.output ?? lastStep?.error ?? 'No output',
      });

      return {
        evaluation: {
          score: evaluation.score,
          success: evaluation.success,
          reflection: evaluation.reflection,
          suggestions: evaluation.suggestions ?? [],
          shouldRetry: evaluation.shouldRetry,
        },
        iterations: state.iterations + 1,
        shouldContinue: evaluation.success && hasMoreSteps(state),
      };
    } catch (error) {
      this.logger.error('Evaluator node failed', error);
      return {
        evaluation: {
          score: successRate,
          success: successRate >= 0.8,
          reflection: `Evaluation failed: ${error instanceof Error ? error.message : 'Unknown'}`,
          suggestions: [],
          shouldRetry: false,
        },
        iterations: state.iterations + 1,
      };
    }
  }

  /**
   * Emit streaming events for a node
   */
  private emitNodeEvents(
    sessionId: string,
    taskId: string,
    state: AgentState,
    node: AgentNode,
  ): void {
    switch (node) {
      case 'executor':
        if (state.currentStep?.toolId) {
          void this.streamingService.emitToolCall(
            sessionId,
            taskId,
            state.currentStep.toolId,
            state.currentStep.input,
          );
        }
        break;

      case 'tool_node': {
        const lastResult = state.toolResults[state.toolResults.length - 1];
        if (lastResult) {
          if (lastResult.error) {
            void this.streamingService.emitStepError(
              sessionId,
              taskId,
              state.plan?.currentStepIndex ?? 0,
              state.plan?.steps.length ?? 0,
              state.currentStep ?? { id: 'unknown', description: 'Unknown' },
              lastResult.error,
            );
          } else {
            void this.streamingService.emitToolResult(
              sessionId,
              taskId,
              lastResult.toolName,
              lastResult.input,
              lastResult.output,
              lastResult.durationMs,
            );
          }
        }
        break;
      }

      case 'evaluator':
        if (state.evaluation) {
          void this.streamingService.emitThinking(
            sessionId,
            taskId,
            state.evaluation.reflection,
          );
        }
        break;
    }
  }

  /**
   * Resolve the model id used by the planner / evaluator ChatOpenAI
   * instances. When `AI_GATEWAY_V2=true`, the gateway owns selection
   * and the resolved `modelId` is preferred over the legacy
   * `'gpt-4o-mini'` default. On any error, the legacy default is
   * returned (preserving the current behaviour for the `false` path).
   */
  private async resolveModelId(
    capability: 'planning' | 'execution' | 'evaluation' | 'tools',
  ): Promise<string> {
    if (this.featureFlags?.isEnabled('AI_GATEWAY_V2') && this.aiGateway) {
      try {
        const resolved = await this.aiGateway.select(null, capability);
        return resolved.model.modelId;
      } catch (err) {
        this.logger.warn(
          `[resolveModelId] gateway lookup failed for ${capability}: ${String(err)}`,
        );
      }
    }
    return 'gpt-4o-mini';
  }
}
