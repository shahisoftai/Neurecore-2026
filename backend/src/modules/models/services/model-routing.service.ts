import { Injectable, Logger } from '@nestjs/common';

export interface ModelSpec {
  id: string;
  name: string;
  provider: string;
  contextWindow: number;
  costPerInputToken: number; // USD per 1K tokens
  costPerOutputToken: number;
  capabilities: string[];
  maxConcurrent: number;
  isAvailable: boolean;
}

export interface ModelSelectionInput {
  complexity: 'low' | 'medium' | 'high';
  taskType:
    | 'planning'
    | 'execution'
    | 'evaluation'
    | 'conversation'
    | 'coding'
    | 'reasoning';
  budgetCeilUsd?: number;
  preferSpeed?: boolean;
}

export interface ModelSelectionResult {
  recommended: ModelSpec;
  fallback: ModelSpec;
  reasoning: string;
}

/**
 * ModelRoutingService — SRP: selects optimal LLM model based on task context.
 * OCP: New models can be registered without modifying routing logic.
 */
@Injectable()
export class ModelRoutingService {
  private readonly logger = new Logger(ModelRoutingService.name);

  /** Model registry — OCP: add new models here without changing routing logic */
  private readonly models: ModelSpec[] = [
    {
      id: 'gpt-4o',
      name: 'GPT-4o',
      provider: 'openai',
      contextWindow: 128_000,
      costPerInputToken: 0.005,
      costPerOutputToken: 0.015,
      capabilities: [
        'planning',
        'execution',
        'evaluation',
        'coding',
        'conversation',
      ],
      maxConcurrent: 50,
      isAvailable: true,
    },
    {
      id: 'gpt-4o-mini',
      name: 'GPT-4o Mini',
      provider: 'openai',
      contextWindow: 128_000,
      costPerInputToken: 0.00015,
      costPerOutputToken: 0.0006,
      capabilities: ['execution', 'conversation', 'evaluation'],
      maxConcurrent: 200,
      isAvailable: true,
    },
    {
      id: 'claude-3-5-sonnet-20241022',
      name: 'Claude 3.5 Sonnet',
      provider: 'anthropic',
      contextWindow: 200_000,
      costPerInputToken: 0.003,
      costPerOutputToken: 0.015,
      capabilities: [
        'planning',
        'execution',
        'evaluation',
        'coding',
        'conversation',
      ],
      maxConcurrent: 50,
      isAvailable: true,
    },
    {
      id: 'claude-3-haiku-20240307',
      name: 'Claude 3 Haiku',
      provider: 'anthropic',
      contextWindow: 200_000,
      costPerInputToken: 0.00025,
      costPerOutputToken: 0.00125,
      capabilities: ['execution', 'conversation'],
      maxConcurrent: 200,
      isAvailable: true,
    },
    {
      id: 'minimax-m2.5',
      name: 'MiniMax M2.5',
      provider: 'minimax',
      contextWindow: 1_000_000,
      costPerInputToken: 0.0001,
      costPerOutputToken: 0.0001,
      capabilities: [
        'planning',
        'execution',
        'evaluation',
        'coding',
        'conversation',
        'reasoning',
      ],
      maxConcurrent: 200,
      isAvailable: true,
    },
    {
      id: 'minimax-abab6.5s-chat',
      name: 'MiniMax ABAB 6.5s Chat',
      provider: 'minimax',
      contextWindow: 245_760,
      costPerInputToken: 0.0001,
      costPerOutputToken: 0.0001,
      capabilities: [
        'planning',
        'execution',
        'evaluation',
        'coding',
        'conversation',
      ],
      maxConcurrent: 200,
      isAvailable: true,
    },
    {
      id: 'minimax-abab6.5g-chat',
      name: 'MiniMax ABAB 6.5g Chat',
      provider: 'minimax',
      contextWindow: 245_760,
      costPerInputToken: 0.00012,
      costPerOutputToken: 0.00012,
      capabilities: [
        'planning',
        'execution',
        'evaluation',
        'coding',
        'conversation',
      ],
      maxConcurrent: 200,
      isAvailable: true,
    },
    // DeepSeek models - strong for reasoning tasks
    {
      id: 'deepseek-chat',
      name: 'DeepSeek V3',
      provider: 'deepseek',
      contextWindow: 640_000,
      costPerInputToken: 0.0001,
      costPerOutputToken: 0.00027,
      capabilities: [
        'planning',
        'execution',
        'evaluation',
        'coding',
        'conversation',
        'reasoning',
      ],
      maxConcurrent: 100,
      isAvailable: true,
    },
    {
      id: 'deepseek-reasoner',
      name: 'DeepSeek R1',
      provider: 'deepseek',
      contextWindow: 640_000,
      costPerInputToken: 0.0001,
      costPerOutputToken: 0.00027,
      capabilities: ['planning', 'evaluation', 'reasoning', 'coding'],
      maxConcurrent: 50,
      isAvailable: true,
    },
    // Xiaomi MiMo - balanced for agentic tasks
    {
      id: 'mimo-pro',
      name: 'MiMo V2 Pro',
      provider: 'mimo',
      contextWindow: 128_000,
      costPerInputToken: 0.00008,
      costPerOutputToken: 0.00024,
      capabilities: [
        'planning',
        'execution',
        'evaluation',
        'coding',
        'conversation',
      ],
      maxConcurrent: 150,
      isAvailable: true,
    },
  ];

  getAvailableModels(): ModelSpec[] {
    return this.models.filter((m) => m.isAvailable);
  }

  getModel(id: string): ModelSpec | undefined {
    return this.models.find((m) => m.id === id);
  }

  /**
   * Select the optimal model for the given task context.
   * Uses a weighted scoring algorithm: capability match + cost + speed.
   */
  selectModel(input: ModelSelectionInput): ModelSelectionResult {
    const candidates = this.models.filter(
      (m) => m.isAvailable && m.capabilities.includes(input.taskType),
    );

    if (candidates.length === 0) {
      const fallback = this.models.find((m) => m.isAvailable) ?? this.models[0];
      return {
        recommended: fallback,
        fallback,
        reasoning: 'No model matched task type, using first available.',
      };
    }

    // Score each candidate
    const scored = candidates
      .map((m) => ({
        model: m,
        score: this.scoreModel(m, input),
      }))
      .sort((a, b) => b.score - a.score);

    const recommended = scored[0].model;
    const fallback = scored[1]?.model ?? scored[0].model;

    const reasoning = this.buildReasoning(recommended, input);
    this.logger.log(
      `[ModelRouting] Selected ${recommended.id} for ${input.taskType} (complexity=${input.complexity})`,
    );

    return { recommended, fallback, reasoning };
  }

  private scoreModel(model: ModelSpec, input: ModelSelectionInput): number {
    let score = 0;

    // Complexity matching
    const complexityMap = {
      low: ['gpt-4o-mini', 'claude-3-haiku-20240307'],
      medium: ['gpt-4o-mini', 'claude-3-5-sonnet-20241022'],
      high: ['gpt-4o', 'claude-3-5-sonnet-20241022'],
    };
    if (complexityMap[input.complexity].includes(model.id)) score += 40;

    // Budget ceiling
    if (input.budgetCeilUsd !== undefined) {
      const estimatedCost =
        1000 * model.costPerInputToken + 500 * model.costPerOutputToken;
      if (estimatedCost <= input.budgetCeilUsd) score += 20;
      else score -= 30; // Over budget — penalise heavily
    }

    // Speed preference — lower cost usually means faster
    if (input.preferSpeed) {
      score +=
        (1 / (model.costPerInputToken + model.costPerOutputToken)) * 0.001;
    }

    // Context window bonus
    if (model.contextWindow >= 128_000) score += 10;

    return score;
  }

  private buildReasoning(model: ModelSpec, input: ModelSelectionInput): string {
    return `Selected ${model.name} (${model.provider}) for ${input.taskType} task with ${input.complexity} complexity. Cost: $${model.costPerInputToken}/1K input tokens.`;
  }
}
