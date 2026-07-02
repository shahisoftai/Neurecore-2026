import { Injectable, Logger } from '@nestjs/common';
import { StateGraph, Annotation, END } from '@langchain/langgraph';
import {
  HermesRouterService,
  type RouterDecision,
} from '../services/hermes-router.service';
import { HermesRuntimeService } from '../services/hermes-runtime.service';
import type { HermesExecutionRequest } from '../interfaces/hermes-runtime.interface';
import type { HermesAgentType } from '@prisma/client';

export const HermesRouterStateAnnotation = Annotation.Root({
  tenantId: Annotation<string>(),
  userId: Annotation<string>(),
  workspaceId: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  threadId: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  task: Annotation<string | null>({
    reducer: (_left, right) => right ?? right,
    default: () => null,
  }),
  preferredAgentType: Annotation<HermesAgentType | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  routedAgentId: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  routedAgentType: Annotation<HermesAgentType | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  result: Annotation<unknown>({
    reducer: (_left, right) => right ?? _left,
    default: () => null,
  }),
  error: Annotation<string | null>({
    reducer: (_left, right) => right ?? _left,
    default: () => null,
  }),
  success: Annotation<boolean>({
    reducer: (_left, right) => right ?? _left,
    default: () => true,
  }),
  shouldContinue: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => true,
  }),
});

export type HermesRouterState = typeof HermesRouterStateAnnotation.State;

@Injectable()
export class HermesRouterNode {
  private readonly logger = new Logger(HermesRouterNode.name);

  constructor(private readonly router: HermesRouterService) {}

  async route(state: HermesRouterState): Promise<Partial<HermesRouterState>> {
    if (!state.task) {
      return {
        error: 'No task provided',
        success: false,
        shouldContinue: false,
      };
    }

    try {
      const decision: RouterDecision = await this.router.route(
        state.task,
        state.tenantId,
        state.preferredAgentType ?? undefined,
      );

      this.logger.log(
        `[HermesRouter] Task routed to ${decision.agentType} agent ${decision.agentId} (confidence: ${decision.confidence})`,
      );

      return {
        routedAgentId: decision.agentId,
        routedAgentType: decision.agentType,
        shouldContinue: true,
      };
    } catch (err) {
      this.logger.error(`[HermesRouter] Routing failed: ${err}`);
      return {
        error: err instanceof Error ? err.message : String(err),
        success: false,
        shouldContinue: false,
      };
    }
  }
}

export function createHermesRouterGraph(routerNode: HermesRouterNode) {
  const workflow = new StateGraph(HermesRouterStateAnnotation);

  workflow.addNode('router', async (state: HermesRouterState) =>
    routerNode.route(state),
  );

  workflow.addEdge('__start__', 'router' as any);
  workflow.addEdge('router' as any, '__end__');

  return workflow;
}

export function createHermesSubgraph(
  agentType: HermesAgentType,
  runtimeService: HermesRuntimeService,
) {
  const SubgraphAnnotation = Annotation.Root({
    tenantId: Annotation<string>(),
    userId: Annotation<string>(),
    workspaceId: Annotation<string | null>({
      reducer: (_left, right) => right ?? null,
      default: () => null,
    }),
    threadId: Annotation<string | null>({
      reducer: (_left, right) => right ?? null,
      default: () => null,
    }),
    sessionId: Annotation<string | null>({
      reducer: (_left, right) => right ?? null,
      default: () => null,
    }),
    task: Annotation<string | null>({
      reducer: (_left, right) => right ?? right,
      default: () => null,
    }),
    allowedTools: Annotation<string[]>({
      reducer: (_left, right) => (right.length > 0 ? right : _left),
      default: () => [],
    }),
    maxIterations: Annotation<number>({
      reducer: (_left, right) => (right > 0 ? right : _left),
      default: () => 10,
    }),
    result: Annotation<unknown>({
      reducer: (_left, right) => right ?? _left,
      default: () => null,
    }),
    error: Annotation<string | null>({
      reducer: (_left, right) => right ?? _left,
      default: () => null,
    }),
    success: Annotation<boolean>({
      reducer: (_left, right) => right ?? _left,
      default: () => true,
    }),
    shouldContinue: Annotation<boolean>({
      reducer: (_left, right) => right,
      default: () => true,
    }),
  });

  type SubgraphState = typeof SubgraphAnnotation.State;

  const subgraph = new StateGraph(SubgraphAnnotation);

  subgraph.addNode(
    `${agentType.toLowerCase()}_agent`,
    async (state: SubgraphState) => {
      if (!state.task) {
        return { error: 'No task', success: false, shouldContinue: false };
      }

      try {
        const request: HermesExecutionRequest = {
          sessionId: state.sessionId ?? '',
          hermesAgentId: state.sessionId ?? '',
          task: state.task,
          context: {
            tenantId: state.tenantId,
            workspaceId: state.workspaceId ?? undefined,
            userId: state.userId,
            threadId: state.threadId ?? '',
          },
          tools: state.allowedTools.length > 0 ? state.allowedTools : undefined,
          maxIterations: state.maxIterations,
        };

        const execResult = await runtimeService.execute(request);

        return {
          result: execResult.output ?? execResult.error,
          success: execResult.success,
          error: execResult.error ?? null,
          shouldContinue: false,
        };
      } catch (err) {
        return {
          error: err instanceof Error ? err.message : String(err),
          success: false,
          shouldContinue: false,
        };
      }
    },
  );

  subgraph.addEdge('__start__', `${agentType.toLowerCase()}_agent` as any);
  subgraph.addEdge(`${agentType.toLowerCase()}_agent` as any, '__end__');

  return { annotation: SubgraphAnnotation, graph: subgraph };
}
