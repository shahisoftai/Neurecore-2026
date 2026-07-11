import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SecretProviderService } from '../../security/providers/secret.provider';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
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
 *
 * F3 fix: never reads `OPENAI_API_KEY` directly. The MiniMax/OpenAI
 * key path is owned by `SecretProviderService` and the gateway. When
 * `AI_GATEWAY_V2` is on, plans are produced by `AiGatewayService`
 * (capability=`planning`) with proper failover, cost attribution,
 * and structured output. Otherwise the legacy LangChain path is
 * preserved but uses the MiniMax key sourced from the secret
 * provider, with a model id resolved from the gateway's defaults.
 */
@Injectable()
export class AgentPlannerService implements IAgentPlanner {
  private readonly logger = new Logger(AgentPlannerService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly secrets: SecretProviderService,
    private readonly featureFlags: FeatureFlagService,
    private readonly aiGateway: AiGatewayService,
  ) {}

  async plan(context: PlanningContext): Promise<AgentPlan> {
    this.logger.debug(
      `Planning for agent ${context.agentId}: "${context.goal}"`,
    );

    // F3: try the MiniMax key (real, configured) and the OpenAI key
    // (still empty in prod). If neither is set we fall back to the
    // stub plan (keeps unit tests fast, never 401s on a real call).
    const apiKey =
      this.secrets.getMiniMaxApiKey() || this.secrets.getOpenAiApiKey();
    const useGateway = this.featureFlags.isEnabled('AI_GATEWAY_V2');

    if (useGateway) {
      try {
        return await this.planViaGateway(context);
      } catch (err) {
        this.logger.warn(
          `AI gateway planning failed, falling back to stub: ${String(err)}`,
        );
        return this.buildStubPlan(context);
      }
    }

    if (!apiKey) {
      this.logger.warn('No LLM API key configured — returning stub plan');
      return this.buildStubPlan(context);
    }

    return this.buildLlmPlan(context, apiKey);
  }

  private async planViaGateway(context: PlanningContext): Promise<AgentPlan> {
    const toolList = context.availableTools.length
      ? context.availableTools.join(', ')
      : 'none';
    const constraintList = context.constraints?.length
      ? context.constraints.join('; ')
      : 'none';
    const schema = gatewayPlanSchema();
    const { data } = await this.aiGateway.invokeStructured<AgentPlan>({
      tenantId: null,
      capability: 'planning',
      sourceModule: 'agent-planner',
      prompt:
        `Goal: ${context.goal}\nAvailable tools: ${toolList}\nConstraints: ${constraintList}\n\n` +
        'Decompose the goal into 1-5 atomic, ordered steps. Return ONLY JSON matching the schema.',
      schema,
    });
    return data;
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

      // F3: use the MiniMax base URL for any non-OpenAI key path. If
      // the resolved key is the OpenAI one, the base URL stays at
      // api.openai.com. The OpenAI key is normally empty in prod so
      // this branch is effectively only hit in dev/test with a real
      // OPENAI_API_KEY configured.
      const baseUrl = this.secrets.getOpenAiApiKey()
        ? 'https://api.openai.com/v1'
        : 'https://api.minimaxi.com/v1';
      const llm = new ChatOpenAI({
        apiKey,
        model: 'MiniMax-M2.7-highspeed',
        temperature: 0.2,
        maxTokens: 1024,
        configuration: { baseURL: baseUrl },
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

function gatewayPlanSchema() {
  // Local import keeps the test path off the `zod` runtime when the
  // gateway is not in use.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const z = require('zod').z;
  const planStepSchema = z.object({
    id: z.string(),
    description: z.string(),
    toolId: z.string().nullable().optional(),
    input: z.record(z.unknown()).optional(),
    dependsOn: z.array(z.string()).optional(),
  });
  return z
    .object({
      goal: z.string(),
      estimatedTokens: z.number().int().nonnegative().optional(),
      reasoning: z.string().optional(),
      steps: z.array(planStepSchema),
    })
    .transform(
      (v: {
        goal: string;
        estimatedTokens?: number;
        steps: Array<{
          id: string;
          description: string;
          toolId?: string | null;
          input?: Record<string, unknown>;
          dependsOn?: string[];
        }>;
      }) => ({
        goal: v.goal,
        estimatedTokens: v.estimatedTokens ?? 0,
        steps: v.steps.map((s, i) => ({
          id: s.id || `step-${i + 1}`,
          description: s.description,
          toolId: s.toolId ?? undefined,
          input: s.input ?? {},
          dependsOn: s.dependsOn ?? [],
        })),
      }),
    );
}
