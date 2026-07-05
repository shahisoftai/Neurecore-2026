import type {
  HermesExecutionContext,
  HermesExecuteResult,
} from '../common/hermes.types';

export interface IHermesRuntime {
  execute(context: HermesExecutionContext): Promise<HermesExecuteResult>;
  getStatus(hermesAgentId: string): Promise<string>;
  cancel(sessionId: string): void;
}

export const HERMES_RUNTIME = Symbol('HERMES_RUNTIME');
