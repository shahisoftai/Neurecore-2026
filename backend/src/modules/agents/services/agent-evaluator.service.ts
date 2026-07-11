import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  IAgentEvaluator,
  EvaluationInput,
  EvaluationResult,
} from '../interfaces/agent-evaluator.interface';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';

/**
 * AgentEvaluatorService
 *
 * Responsibility (SRP): Score the quality of a completed task execution
 * and produce reflective feedback.  Implements the reflection loop pattern
 * — results feed back into the planner for future tasks.
 *
 * LangChain is used when OPENAI_API_KEY is available; falls back to
 * heuristic scoring so the platform remains functional without an API key.
 *
 * S15 (per ai-gateway-imp-plan.md): when `AI_GATEWAY_V2=true`, the
 * evaluator routes through `AiGatewayService.invokeStructured` with
 * capability=`evaluation`. Otherwise the legacy ChatOpenAI path is
 * preserved.
 *
 * SOLID:
 *  - SRP: only evaluates — does not plan or execute
 *  - OCP: scoring strategy swappable via subclass (LLM vs heuristic)
 *  - DIP: depends on IAgentEvaluator abstraction + ConfigService injection
 */
@Injectable()
export class AgentEvaluatorService implements IAgentEvaluator {
  private readonly logger = new Logger(AgentEvaluatorService.name);

  constructor(
    private readonly config: ConfigService,
    @Optional() private readonly featureFlags?: FeatureFlagService,
    @Optional() private readonly aiGateway?: AiGatewayService,
  ) {}

  async evaluate(input: EvaluationInput): Promise<EvaluationResult> {
    this.logger.debug(
      `Evaluating task ${input.taskId} for agent ${input.agentId}`,
    );

    // V2 routing: gateway owns the call + structured output + cost.
    if (this.featureFlags?.isEnabled('AI_GATEWAY_V2') && this.aiGateway) {
      try {
        return await this.gatewayEvaluate(input);
      } catch (err) {
        this.logger.warn(
          `AI gateway evaluation failed, falling back: ${String(err)}`,
        );
      }
    }

    const apiKey = this.config.get<string>('OPENAI_API_KEY');

    if (apiKey) {
      return this.llmEvaluate(input, apiKey);
    }

    return this.heuristicEvaluate(input);
  }

  private async gatewayEvaluate(
    input: EvaluationInput,
  ): Promise<EvaluationResult> {
    if (!this.aiGateway) {
      return this.heuristicEvaluate(input);
    }
    const stepSummary = input.steps
      .map(
        (s) =>
          `- ${s.description}: ${s.success ? '✓' : '✗'} ${
            s.output ? JSON.stringify(s.output).slice(0, 100) : ''
          }`,
      )
      .join('\n');
    const prompt = `You are an AI task evaluator. Evaluate the quality of an AI agent's task execution.
Provide a structured evaluation with score, success status, reflection, and suggestions.

Goal: ${input.goal}

Steps executed:
${stepSummary}

Final output: ${JSON.stringify(input.finalOutput ?? null).slice(0, 200)}`;
    const { data } = await this.aiGateway.invokeStructured<{
      score: number;
      success: boolean;
      reflection: string;
      suggestions?: string[];
      shouldRetry: boolean;
    }>({
      tenantId: null,
      capability: 'evaluation',
      sourceModule: 'agent-evaluator',
      prompt,
      schema: evaluationZodSchema(),
    });
    return {
      score: data.score,
      success: data.success,
      reflection: data.reflection,
      suggestions: data.suggestions ?? [],
      shouldRetry: data.shouldRetry,
    };
  }

  // ───────────────────────────────────────────────────────────
  // LangChain-based evaluation with structured output
  // ───────────────────────────────────────────────────────────

  private async llmEvaluate(
    input: EvaluationInput,
    apiKey: string,
  ): Promise<EvaluationResult> {
    try {
      // Dynamic import keeps startup fast when LangChain is not needed
      const { ChatOpenAI } = await import('@langchain/openai');
      const { ChatPromptTemplate } = await import('@langchain/core/prompts');
      const { z } = await import('zod');

      const llm = new ChatOpenAI({
        apiKey,
        model: 'gpt-4o-mini',
        temperature: 0,
        maxTokens: 512,
      });

      const stepSummary = input.steps
        .map(
          (s) =>
            `- ${s.description}: ${s.success ? '✓' : '✗'} ${
              s.output ? JSON.stringify(s.output).slice(0, 100) : ''
            }`,
        )
        .join('\n');

      // Define evaluation schema for structured output
      const evaluationSchema = z.object({
        score: z.number().min(0).max(1).describe('Quality score 0.0-1.0'),
        success: z.boolean().describe('Whether the task succeeded'),
        reflection: z
          .string()
          .describe('One sentence summary of the execution'),
        suggestions: z
          .array(z.string())
          .optional()
          .describe('Improvement suggestions'),
        shouldRetry: z.boolean().describe('Whether the task should be retried'),
      });

      const prompt = ChatPromptTemplate.fromMessages([
        [
          'system',
          `You are an AI task evaluator. Evaluate the quality of an AI agent's task execution.
Provide a structured evaluation with score, success status, reflection, and suggestions.`,
        ],
        [
          'human',
          `Goal: {goal}\n\nSteps executed:\n{steps}\n\nFinal output: {output}`,
        ],
      ]);

      // Use withStructuredOutput for type-safe JSON parsing
      const structuredLlm = llm.withStructuredOutput(evaluationSchema);

      const chain = prompt.pipe(structuredLlm);

      const evaluation = await chain.invoke({
        goal: input.goal,
        steps: stepSummary,
        output: JSON.stringify(input.finalOutput ?? null).slice(0, 200),
      });

      this.logger.debug(
        `LLM evaluation score for task ${input.taskId}: ${evaluation.score}`,
      );

      return {
        score: evaluation.score,
        success: evaluation.success,
        reflection: evaluation.reflection,
        suggestions: evaluation.suggestions ?? [],
        shouldRetry: evaluation.shouldRetry,
      };
    } catch (err) {
      this.logger.warn(
        `LLM evaluation failed, falling back to heuristic: ${String(err)}`,
      );
      return this.heuristicEvaluate(input);
    }
  }

  // ───────────────────────────────────────────────────────────
  // Heuristic fallback (no LLM required)
  // ───────────────────────────────────────────────────────────

  private heuristicEvaluate(input: EvaluationInput): EvaluationResult {
    const totalSteps = input.steps.length;
    const successfulSteps = input.steps.filter((s) => s.success).length;
    const successRate = totalSteps > 0 ? successfulSteps / totalSteps : 0;

    // Score based on success rate and whether final output exists
    let score = successRate;
    if (input.finalOutput) {
      score = Math.min(1, score + 0.1);
    }

    const suggestions: string[] = [];
    if (successRate < 1) {
      const failedSteps = input.steps.filter((s) => !s.success);
      suggestions.push(
        `${failedSteps.length} step(s) failed: ${failedSteps.map((s) => s.description).join(', ')}`,
      );
    }

    return {
      score,
      success: successRate >= 0.8,
      reflection: `Heuristic evaluation: ${Math.round(successRate * 100)}% steps succeeded`,
      suggestions,
      shouldRetry: successRate < 0.5,
    };
  }
}

function evaluationZodSchema() {
  // Local require keeps the test path off `zod` when the gateway is
  // not in use.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const z = require('zod').z;
  return z.object({
    score: z.number().min(0).max(1),
    success: z.boolean(),
    reflection: z.string(),
    suggestions: z.array(z.string()).optional(),
    shouldRetry: z.boolean(),
  });
}
