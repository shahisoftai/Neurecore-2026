import type { ActivityEvent, ParticipantType, Prisma } from '@prisma/client';

export interface RecordActivityParams {
  tenantId: string;
  actorType: ParticipantType;
  actorId: string;
  type: string;
  title: string;
  description?: string;
  threadId?: string;
  contextType?: string;
  contextId?: string;
  entityType?: string;
  entityId?: string;
  payload?: Record<string, unknown>;
  severity?: string;
  visibility?: 'tenant' | 'thread' | 'direct';
  targetParticipantType?: ParticipantType;
  targetParticipantId?: string;
  sourceEventId?: string;
  expiresAt?: Date;
  createdAt?: Date;
}

export interface ListActivityOpts {
  userId?: string;
  agentId?: string;
  visibility?: string[];
  limit?: number;
  before?: string;
  since?: string;
  types?: string[];
  severity?: string;
}

export interface IActivityService {
  record(params: RecordActivityParams): Promise<ActivityEvent>;
  list(tenantId: string, opts?: ListActivityOpts): Promise<ActivityEvent[]>;
}

export const ACTIVITY_SERVICE = Symbol('ACTIVITY_SERVICE');

export type { ActivityEvent, Prisma };
