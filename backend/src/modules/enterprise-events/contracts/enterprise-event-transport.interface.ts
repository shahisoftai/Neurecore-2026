/**
 * IEnterpriseEventTransport — the port capabilities depend on (ADR-001).
 *
 * Producers depend on this interface, never on the concrete service, so the
 * transport can be replaced (e.g. with Kafka) without touching capabilities
 * (DIP; enforced by architecture tests). The transport carries NO business
 * logic — it persists, delivers at-least-once, retries, dead-letters, replays.
 */

import type { Prisma } from '@prisma/client';
import type {
  EnterpriseEvent,
  EnterpriseEventHandler,
  PublishEventInput,
} from './enterprise-event.interface';

export const EVENT_TRANSPORT = Symbol('EVENT_TRANSPORT');

export interface ConsumerRegistration {
  /** Stable consumer id (e.g. 'audit', 'ui-projection', 'eie-continuous-discovery'). */
  consumerId: string;
  /** Event types this consumer wants. '*' subscribes to all. */
  eventTypes: string[] | '*';
  handler: EnterpriseEventHandler;
}

export interface PublishResult {
  eventId: string;
  deduplicated: boolean; // true if an event with the same (tenant, idempotencyKey) already existed
}

export interface ConsumerStatus {
  consumerId: string;
  pending: number;
  processing: number;
  processed: number;
  failed: number;
  deadLettered: number;
}

export interface IEnterpriseEventTransport {
  /**
   * Publish an enterprise event (writes to the outbox). Validates against the
   * registry first. If a Prisma transaction client is supplied, the outbox row
   * is written in that SAME transaction (transactional outbox, ADR-001 §8).
   */
  publish(
    input: PublishEventInput,
    tx?: Prisma.TransactionClient,
  ): Promise<PublishResult>;

  /** Register a consumer. Called by consumer modules in onModuleInit(). */
  registerConsumer(registration: ConsumerRegistration): void;

  /** Observability: per-consumer inbox counters. */
  getConsumerStatus(consumerId: string): Promise<ConsumerStatus>;

  /**
   * Administrative, tenant-scoped replay of a dead-letter record.
   * Requires the caller to have already authorized the action.
   */
  replayDeadLetter(deadLetterId: string, tenantId: string): Promise<boolean>;
}
