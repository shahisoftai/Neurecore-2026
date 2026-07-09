import type { AgentMessage } from './IAgentMessaging';

export interface IAgentMessagingGuard {
  /** Throw if this message should not be delivered. */
  check(message: AgentMessage): Promise<void>;
}

export const AGENT_MESSAGING_GUARD = Symbol('AGENT_MESSAGING_GUARD');
