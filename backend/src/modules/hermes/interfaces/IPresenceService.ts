import type { ParticipantType } from '@prisma/client';

export type PresenceStatus =
  | 'working'
  | 'idle'
  | 'thinking'
  | 'blocked'
  | 'waiting_approval'
  | 'meeting'
  | 'offline'
  | 'paused';

export interface PresenceState {
  participantType: ParticipantType;
  participantId: string;
  status: PresenceStatus;
  currentTask?: string;
  currentSession?: string;
  tenantId: string;
  lastSeen: number;
  ttlSeconds: number;
}

export interface SetPresenceMeta {
  currentTask?: string;
  currentSession?: string;
}

export interface IPresenceService {
  setStatus(
    type: ParticipantType,
    id: string,
    status: PresenceStatus,
    tenantId: string,
    meta?: SetPresenceMeta,
  ): Promise<void>;
  getStatus(
    type: ParticipantType,
    id: string,
    tenantId: string,
  ): Promise<PresenceState | null>;
  getActiveByTenant(tenantId: string): Promise<PresenceState[]>;
  subscribe(
    type: ParticipantType,
    id: string,
    callback: (state: PresenceState) => void,
  ): () => void;
}

export const PRESENCE_SERVICE = Symbol('PRESENCE_SERVICE');
