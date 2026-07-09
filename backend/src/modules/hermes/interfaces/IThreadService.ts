import type {
  CommunicationThread,
  ParticipantType,
  ThreadStatus,
} from '@prisma/client';

export interface ThreadParticipantInput {
  type: ParticipantType;
  id: string;
  role?: string;
}

export interface ThreadRequester {
  type: ParticipantType;
  id: string;
  tenantId: string;
}

export interface CreateThreadParams {
  tenantId: string;
  title: string;
  contextType?: string;
  contextId?: string;
  participants: ThreadParticipantInput[];
}

export interface GetMessagesOpts {
  limit?: number;
  before?: string;
}

export interface IThreadService {
  create(params: CreateThreadParams): Promise<CommunicationThread>;

  get(
    threadId: string,
    requester: ThreadRequester,
  ): Promise<CommunicationThread | null>;

  findForEntity(
    contextType: string,
    contextId: string,
    tenantId: string,
  ): Promise<CommunicationThread[]>;

  addParticipant(
    threadId: string,
    participant: ThreadParticipantInput,
    requesterTenantId: string,
  ): Promise<void>;

  getMessages(
    threadId: string,
    requester: ThreadRequester,
    opts?: GetMessagesOpts,
  ): Promise<
    Array<{
      id: string;
      sessionId: string;
      threadId: string | null;
      role: 'USER' | 'HERMES' | 'SYSTEM';
      content: string;
      metadata?: Record<string, unknown>;
      createdAt: Date;
    }>
  >;

  markRead(
    threadId: string,
    participantType: ParticipantType,
    participantId: string,
  ): Promise<void>;

  getUnreadCount(
    participantType: ParticipantType,
    participantId: string,
    tenantId: string,
  ): Promise<number>;

  close(threadId: string, tenantId: string): Promise<void>;

  incrementHopCount(threadId: string): Promise<number>;
}

export const THREAD_SERVICE = Symbol('THREAD_SERVICE');

export type { CommunicationThread, ThreadStatus };
