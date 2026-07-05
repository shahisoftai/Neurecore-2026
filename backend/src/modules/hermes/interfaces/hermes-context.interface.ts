import type { HermesSessionContext } from '../common/hermes.types';

export interface IHermesContext {
  build(params: {
    hermesAgentId: string;
    agentId: string;
    tenantId: string;
    userId?: string;
    workspaceId?: string;
    threadId: string;
  }): Promise<HermesSessionContext>;
}

export const HERMES_CONTEXT = Symbol('HERMES_CONTEXT');
