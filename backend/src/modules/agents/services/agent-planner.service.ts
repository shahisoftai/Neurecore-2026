import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IAgentPlanner,
  AgentPlan,
  PlanningContext,
} from '../interfaces/agent-planner.interface';

/**
 * AgentPlannerService
 *
 * Responsibility (SRP): Converts a goal + context into a structured plan
 * using an LLM.  LangChain integration is encapsulated here so no other
 * service depends on LangChain directly (DIP).
 */
@Injectable()
export class AgentPlannerService implements IAgentPlanner {
  private readonly logger = new Logger(AgentPlannerService.name);

  constructor(private readonly config: ConfigService) {}

  async plan(context: PlanningContext): Promise<AgentPlan> {
    this.logger.debug(
      `Planning for agent ${context.agentId}: "${context.goal}"`,
    );

    // Build a minimal plan without LLM when no API key is configured
    // (keeps unit-tests fast; replace with real LangChain chain in prod)
    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set — returning stub plan');
      return this.buildStubPlan(context);
    }

    return this.buildLlmPlan(context, apiKey);
  }

  async replan(
    plan: AgentPlan,
    failedStepId: string,
    error: string,
  ): Promise<AgentPlan> {
    this.logger.warn(`Replanning: step ${failedStepId} failed — ${error}`);
    // Remove failed step and all dependents
    const failedIds = new Set<string>([failedStepId]);
    for (const step of plan.steps) {
      if (step.dependsOn?.some((d) => failedIds.has(d))) {
        failedIds.add(step.id);
      }
    }
    return {
      ...plan,
      steps: plan.steps.filter((s) => !failedIds.has(s.id)),
    };
  }

  // ───────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────

  private buildStubPlan(context: PlanningContext): AgentPlan {
    return {
      goal: context.goal,
      estimatedTokens: 0,
      steps: [
        {
          id: 'step-1',
          description: `Execute goal: ${context.goal}`,
          input: {},
        },
      ],
    };
  }

  private async buildLlmPlan(
    context: PlanningContext,
    apiKey: string,
  ): Promise<AgentPlan> {
    try {
      const { ChatOpenAI } = await import('@langchain/openai');
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const { z } = await import('zod');

      const llm = new ChatOpenAI({
        apiKey,
        model: 'MiniMax-M2.7-highspeed',
        temperature: 0.2,
        maxTokens: 1024,
      });

      // Define the planning schema for structured output
      const planStepSchema = z.object({
        id: z.string().describe('Unique step identifier'),
        description: z.string().describe('What this step accomplishes'),
        toolId: z.string().nullable().describe('Tool name or null if LLM-only'),
        input: z.record(z.unknown()).describe('Tool input parameters'),
        dependsOn: z
          .array(z.string())
          .describe('Step IDs that must complete first'),
      });

      const agentPlanSchema = z.object({
        goal: z.string().describe('Original goal statement'),
        estimatedTokens: z
          .number()
          .int()
          .positive()
          .optional()
          .describe('Estimated token count'),
        reasoning: z.string().optional().describe('Why this plan was chosen'),
        steps: z.array(planStepSchema).describe('Ordered execution steps'),
      });

      const toolList = context.availableTools.length
        ? context.availableTools.join(', ')
        : 'none';

      const constraintList = context.constraints?.length
        ? context.constraints.join('; ')
        : 'none';

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an AI task planner. Decompose the given goal into ordered steps.
Rules:
- Use only the available tools listed.
- Keep steps atomic — one action per step.
- dependsOn contains step IDs that must complete first.
- Produce 1-5 steps maximum.`,
        ],
        [
          'human',
          `Goal: {goal}\nAvailable tools: {tools}\nConstraints: {constraints}`,
        ],
      ]);

      // Use withStructuredOutput for type-safe JSON parsing
      const structuredLlm = llm.withStructuredOutput(agentPlanSchema);

      const chain = prompt.pipe(structuredLlm);

      const plan = await chain.invoke({
        goal: context.goal,
        tools: toolList,
        constraints: constraintList,
      });

      // Convert to AgentPlan format
      const agentPlan: AgentPlan = {
        goal: plan.goal,
        estimatedTokens: plan.estimatedTokens ?? 0,
        steps: plan.steps.map((s, i) => ({
          id: s.id || `step-${i + 1}`,
          description: s.description,
          toolId: s.toolId ?? undefined,
          input: s.input ?? {},
          dependsOn: s.dependsOn ?? [],
        })),
      };

      this.logger.debug(
        `LLM produced ${agentPlan.steps.length} steps for goal: ${context.goal}`,
      );
      return agentPlan;
    } catch (err) {
      this.logger.warn(
        `LLM planning failed, falling back to stub: ${String(err)}`,
      );
      return this.buildStubPlan(context);
    }
  }
}
