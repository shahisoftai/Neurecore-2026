import type { ParticipantType } from '@prisma/client';

export interface ParticipantProfile {
  id: string;
  type: ParticipantType;
  displayName: string;
  avatarUrl?: string;
  status?: string;
  departmentId?: string;
  tenantId: string;
  metadata?: Record<string, unknown>;
}

export interface ParticipantRef {
  type: ParticipantType;
  id: string;
  tenantId: string;
}

export interface IParticipantResolver {
  resolve(
    type: ParticipantType,
    id: string,
    tenantId: string,
  ): Promise<ParticipantProfile | null>;
  resolveBatch(
    participants: ParticipantRef[],
  ): Promise<Map<string, ParticipantProfile>>;
  search(
    query: string,
    tenantId: string,
    types?: ParticipantType[],
  ): Promise<ParticipantProfile[]>;
}

export const PARTICIPANT_RESOLVER = Symbol('PARTICIPANT_RESOLVER');
