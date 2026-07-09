import type { HermesMessageData } from './hermes-session.interface';
import type { ParticipantType } from '@prisma/client';

export interface AgentMessage {
  id: string;
  idempotencyKey?: string;
  fromAgentId: string;
  toAgentId: string;
  tenantId: string;
  threadId: string;
  hopCount: number;
  content: string;
  expectResponse: boolean;
}

export interface AgentMessagingResult {
  delivered: boolean;
  response?: string;
  blocked?: string;
}

export interface IAgentMessaging {
  send(message: AgentMessage): Promise<AgentMessagingResult>;
  createChannel(
    agentIdA: string,
    agentIdB: string,
    tenantId: string,
  ): Promise<string>;
  getConversation(
    threadId: string,
    participant: { type: ParticipantType; id: string; tenantId: string },
  ): Promise<HermesMessageData[]>;
}

export const AGENT_MESSAGING = Symbol('AGENT_MESSAGING');
