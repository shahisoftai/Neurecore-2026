import { StateGraph, Annotation, END, START } from '@langchain/langgraph';
import { HermesRuntimeService } from '../services/hermes-runtime.service';
import type { HermesExecutionRequest } from '../interfaces/hermes-runtime.interface';

export const HermesStateAnnotation = Annotation.Root({
  tenantId: Annotation<string>(),
  userId: Annotation<string>(),
  workspaceId: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  hermesAgentId: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  sessionId: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  threadId: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
    default: () => null,
  }),
  task: Annotation<string | null>({
    reducer: (_left, right) => right ?? null,
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
  iteration: Annotation<number>({
    reducer: (left, right) => left + right,
    default: () => 0,
  }),
  shouldContinue: Annotation<boolean>({
    reducer: (_left, right) => right,
    default: () => true,
  }),
});

export type HermesGraphState = typeof HermesStateAnnotation.State;

export type HermesNodeParams = {
  runtimeService: HermesRuntimeService;
  getDefaultAgentId?: (tenantId: string) => Promise<string | null>;
};

export function createHermesNode(params: HermesNodeParams) {
  return async (
    state: HermesGraphState,
  ): Promise<Partial<HermesGraphState>> => {
    if (!state.hermesAgentId || !state.task) {
      return {
        error: 'Missing hermesAgentId or task in state',
        success: false,
        shouldContinue: false,
      };
    }

    const request: HermesExecutionRequest = {
      sessionId: state.sessionId ?? '',
      hermesAgentId: state.hermesAgentId,
      task: state.task,
      context: {
        tenantId: state.tenantId,
        workspaceId: state.workspaceId ?? undefined,
        userId: state.userId,
        threadId: state.threadId ?? '',
      },
      tools: state.allowedTools.length > 0 ? state.allowedTools : undefined,
      maxIterations: state.maxIterations > 0 ? state.maxIterations : 10,
    };

    const result = await params.runtimeService.execute(request);

    return {
      result: result.output ?? result.error,
      success: result.success,
      error: result.error ?? null,
      iteration: 1,
      shouldContinue: false,
    };
  };
}

export function createHermesGraph(params: HermesNodeParams) {
  const workflow = new StateGraph(HermesStateAnnotation);

  workflow.addNode('hermes', createHermesNode(params));
  workflow.addEdge(START, 'hermes' as any);
  workflow.addEdge('hermes' as any, END);

  return workflow;
}
