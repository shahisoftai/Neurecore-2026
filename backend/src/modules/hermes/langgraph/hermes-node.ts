import { Logger } from '@nestjs/common';
import type { HermesRuntimeService } from '../services/hermes-runtime.service';
import type { HermesRegistryService } from '../services/hermes-registry.service';
import type {
  HermesExecutionRequest,
  HermesExecutionResult,
} from '../interfaces/hermes-runtime.interface';

export interface HermesNodeState {
  hermesAgentId: string;
  sessionId: string;
  task: string;
  context: {
    tenantId: string;
    workspaceId?: string;
    userId: string;
    threadId: string;
    hermesNodeId?: string;
  };
  constraints?: {
    maxCostUsd?: number;
    maxDurationMs?: number;
    requiredCapabilities?: string[];
  };
}

export interface HermesNodeResult {
  success: boolean;
  hermesResult?: HermesExecutionResult;
  selectedHermesAgentId?: string;
  selectedHermesType?: string;
  error?: string;
}

const logger = new Logger('HermesNode');

export function createHermesNode(
  hermesRuntime: HermesRuntimeService,
) {
  return async (
    state: HermesNodeState,
    config?: { configurable?: Record<string, unknown> },
  ): Promise<HermesNodeResult> => {
    const threadId =
      (config?.configurable?.thread_id as string) ??
      state.context.threadId ??
      state.sessionId;

    try {
      const executionRequest: HermesExecutionRequest = {
        sessionId: state.sessionId,
        hermesAgentId: state.hermesAgentId,
        task: state.task,
        context: {
          tenantId: state.context.tenantId,
          workspaceId: state.context.workspaceId,
          userId: state.context.userId,
          threadId,
        },
      };

      logger.log(
        `[HermesNode] Executing agent ${state.hermesAgentId} for task: ${state.task.substring(0, 100)}`,
      );

      const result = await hermesRuntime.execute(executionRequest);

      return {
        success: result.success,
        hermesResult: result,
        selectedHermesAgentId: state.hermesAgentId,
        error: result.error,
      };
    } catch (err) {
      logger.error(
        `[HermesNode] Execution failed: ${(err as Error).message}`,
      );

      return {
        success: false,
        error: (err as Error).message,
      };
    }
  };
}

export async function selectHermesAgent(
  task: string,
  tenantId: string,
  registry: HermesRegistryService,
): Promise<{
  agentId: string;
  agentType: string;
  score: number;
} | null> {
  const intent = classifyTaskIntent(task);

  logger.log(
    `[HermesRouter] Classified task intent: ${intent.capability} (type: ${intent.hermesType})`,
  );

  if (intent.hermesType) {
    const agents = await registry.findByType(
      intent.hermesType as any,
      tenantId,
    );

    const idleAgents = agents.filter(
      (a) => a.status === 'IDLE' && a.isActive,
    );

    if (idleAgents.length > 0) {
      const scored = idleAgents
        .map((a) => ({
          agentId: a.id,
          agentType: a.type,
          score: calculateAgentScore(a, intent),
        }))
        .sort((a, b) => b.score - a.score);

      return scored[0];
    }
  }

  const agents = await registry.findByCapability(
    intent.capability,
    tenantId,
  );

  const idleAgents = agents.filter(
    (a) => a.status === 'IDLE' && a.isActive,
  );

  if (idleAgents.length === 0) return null;

  const scored = idleAgents
    .map((a) => ({
      agentId: a.id,
      agentType: a.type,
      score: calculateAgentScore(a, intent),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0] ?? null;
}

interface TaskIntent {
  capability: string;
  hermesType?: string;
  confidence: number;
}

function classifyTaskIntent(task: string): TaskIntent {
  const lower = task.toLowerCase();

  const patterns: Array<{
    keywords: string[];
    capability: string;
    hermesType: string;
  }> = [
    {
      keywords: [
        'hire',
        'onboarding',
        'employee',
        'payroll',
        'terminate',
        'firing',
        'hr',
        'recruit',
        'interview',
        'offer letter',
      ],
      capability: 'hr_operations',
      hermesType: 'HR',
    },
    {
      keywords: [
        'invoice',
        'payment',
        'expense',
        'budget',
        'refund',
        'finance',
        'accounting',
        'tax',
        'revenue',
        'vendor payment',
      ],
      capability: 'finance_operations',
      hermesType: 'FINANCE',
    },
    {
      keywords: [
        'deal',
        'sales',
        'quote',
        'proposal',
        'crm',
        'pipeline',
        'discount',
        'client',
        'lead',
        'opportunity',
      ],
      capability: 'sales_operations',
      hermesType: 'SALES',
    },
    {
      keywords: [
        'contract',
        'legal',
        'nda',
        'compliance',
        'law',
        'regulation',
        'agreement',
        'terms',
      ],
      capability: 'legal_operations',
      hermesType: 'LEGAL',
    },
    {
      keywords: [
        'marketing',
        'campaign',
        'advertisement',
        'social media',
        'content',
        'seo',
        'brand',
      ],
      capability: 'marketing_operations',
      hermesType: 'MARKETING',
    },
    {
      keywords: [
        'research',
        'analyze',
        'report',
        'study',
        'survey',
        'data',
        'insight',
      ],
      capability: 'research_operations',
      hermesType: 'RESEARCH',
    },
    {
      keywords: [
        'code',
        'developer',
        'bug',
        'feature',
        'pull request',
        'deploy',
        'api',
        'test engineer',
      ],
      capability: 'engineering_operations',
      hermesType: 'ENGINEERING',
    },
    {
      keywords: [
        'qa',
        'test',
        'quality',
        'bug report',
        'testing',
        'regression',
      ],
      capability: 'qa_operations',
      hermesType: 'QA',
    },
    {
      keywords: [
        'security',
        'audit',
        'vulnerability',
        'threat',
        'block',
        'incident',
        'access',
      ],
      capability: 'security_operations',
      hermesType: 'SECURITY',
    },
    {
      keywords: [
        'operations',
        'scheduling',
        'workflow',
        'automation',
        'process',
        'logistics',
      ],
      capability: 'operations',
      hermesType: 'OPERATIONS',
    },
    {
      keywords: [
        'support',
        'ticket',
        'customer',
        'help',
        'issue',
        'complaint',
        'refund',
      ],
      capability: 'support_operations',
      hermesType: 'CUSTOMER_SUPPORT',
    },
  ];

  let bestMatch: TaskIntent = {
    capability: 'general',
    confidence: 0,
  };

  for (const pattern of patterns) {
    const matches = pattern.keywords.filter((k) =>
      lower.includes(k),
    );
    if (matches.length > 0) {
      const confidence = matches.length / pattern.keywords.length;
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          capability: pattern.capability,
          hermesType: pattern.hermesType,
          confidence,
        };
      }
    }
  }

  return bestMatch;
}

function calculateAgentScore(
  agent: any,
  intent: TaskIntent,
): number {
  let score = 50;

  if (agent.capabilities?.length > 0) {
    const matchingCaps = agent.capabilities.filter(
      (c: any) =>
        c.name &&
        intent.capability &&
        c.name
          .toLowerCase()
          .includes(intent.capability.toLowerCase()),
    );
    score += matchingCaps.length * 10;
  }

  if (agent.cost?.totalSpend !== undefined) {
    score += 10;
  }

  score += Math.random() * 10;

  return score;
}
