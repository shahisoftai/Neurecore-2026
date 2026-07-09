import type { ParticipantType } from '@prisma/client';
import type { HermesMessageData } from './hermes-session.interface';

export interface ConversationSummary {
  period: { from: Date; to: Date };
  participantId: string;
  participantType: ParticipantType;
  totalMessages: number;
  totalDecisions: number;
  keyTopics: string[];
  actionItems: string[];
  narrative: string;
}

export interface SummarizeParams {
  participantType: ParticipantType;
  participantId: string;
  tenantId: string;
  from: Date;
  to: Date;
}

export interface SearchParams {
  tenantId: string;
  query: string;
  limit?: number;
}

export interface AskParams {
  tenantId: string;
  question: string;
  /** Phase 9d §16.4.3 — limit retrieval to agents in a department. */
  scopeDepartmentId?: string;
}

export interface IConversationIntelligence {
  summarize(params: SummarizeParams): Promise<ConversationSummary>;
  search(
    params: SearchParams,
  ): Promise<Array<{ message: HermesMessageData; score: number }>>;
  ask(params: AskParams): Promise<{ answer: string; sources: string[] }>;
}

export const CONVERSATION_INTELLIGENCE = Symbol('CONVERSATION_INTELLIGENCE');
