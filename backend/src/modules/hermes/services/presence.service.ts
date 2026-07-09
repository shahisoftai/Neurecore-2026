import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { EventsGateway } from '../../events/events.gateway';
import type {
  IPresenceService,
  PresenceState,
  PresenceStatus,
  SetPresenceMeta,
} from '../interfaces/IPresenceService';
import type { ParticipantType } from '@prisma/client';
import { PRESENCE_SERVICE } from '../interfaces/IPresenceService';

/**
 * PresenceService — Phase 7.
 *
 * Redis-backed, multi-instance safe. Heartbeat TTL + background sweep
 * for stale entries. Tenant-scoped at every level (no 'all' fallback).
 */
@Injectable()
export class PresenceService
  implements IPresenceService, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PresenceService.name);
  private readonly TTL_SECONDS = 120;
  private readonly STALE_TIMEOUT = 300;
  private readonly SWEEP_INTERVAL_MS = 60_000;
  private readonly subscribers = new Map<
    string,
    Set<(state: PresenceState) => void>
  >();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly eventsGateway: EventsGateway,
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      this.sweepStale().catch((err) =>
        this.logger.warn(`sweepStale failed: ${String(err)}`),
      );
    }, this.SWEEP_INTERVAL_MS);
    // Avoid keeping the event loop alive for testing
    if (typeof this.sweepTimer.unref === 'function') {
      this.sweepTimer.unref();
    }
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
  }

  private key(type: ParticipantType, id: string, tenantId: string): string {
    return `presence:${tenantId}:${type}:${id}`;
  }

  private subKey(type: ParticipantType, id: string): string {
    return `${type}:${id}`;
  }

  async setStatus(
    type: ParticipantType,
    id: string,
    status: PresenceStatus,
    tenantId: string,
    meta?: SetPresenceMeta,
  ): Promise<void> {
    const state: PresenceState = {
      participantType: type,
      participantId: id,
      status,
      tenantId,
      currentTask: meta?.currentTask,
      currentSession: meta?.currentSession,
      lastSeen: Date.now(),
      ttlSeconds: status === 'offline' ? 30 : this.TTL_SECONDS,
    };

    await this.redis.setJson(
      this.key(type, id, tenantId),
      state,
      state.ttlSeconds,
    );

    this.subscribers.get(this.subKey(type, id))?.forEach((cb) => {
      try {
        cb(state);
      } catch (err) {
        this.logger.warn(`Subscriber callback error: ${String(err)}`);
      }
    });

    this.eventsGateway.emitToTenant(tenantId, 'presence:updated', state);
  }

  async getStatus(
    type: ParticipantType,
    id: string,
    tenantId: string,
  ): Promise<PresenceState | null> {
    const raw = await this.redis.getJson<PresenceState>(
      this.key(type, id, tenantId),
    );
    return raw ?? null;
  }

  async getActiveByTenant(tenantId: string): Promise<PresenceState[]> {
    const results: PresenceState[] = [];
    let cursor = '0';
    do {
      const [nextCursor, found] = await this.redis.scan(
        cursor,
        `presence:${tenantId}:*`,
        100,
      );
      cursor = nextCursor;
      for (const k of found) {
        const raw = await this.redis.getJson<PresenceState>(k);
        if (raw) results.push(raw);
      }
    } while (cursor !== '0');
    return results;
  }

  subscribe(
    type: ParticipantType,
    id: string,
    callback: (state: PresenceState) => void,
  ): () => void {
    const key = this.subKey(type, id);
    if (!this.subscribers.has(key)) this.subscribers.set(key, new Set());
    this.subscribers.get(key)!.add(callback);
    return () => {
      this.subscribers.get(key)?.delete(callback);
    };
  }

  private async sweepStale(): Promise<void> {
    let cursor = '0';
    do {
      const [nextCursor, found] = await this.redis.scan(
        cursor,
        'presence:*',
        100,
      );
      cursor = nextCursor;
      const now = Date.now();
      for (const key of found) {
        const raw = await this.redis.getJson<PresenceState>(key);
        if (!raw) continue;
        if (raw.status === 'offline') continue;
        if (now - raw.lastSeen > this.STALE_TIMEOUT * 1000) {
          await this.setStatus(
            raw.participantType,
            raw.participantId,
            'offline',
            raw.tenantId,
          );
          this.logger.warn(
            `Swept stale presence: ${raw.participantType}:${raw.participantId}`,
          );
        }
      }
    } while (cursor !== '0');
  }
}

export { PRESENCE_SERVICE };
