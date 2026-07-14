/**
 * Enterprise Event Fabric — Event Contract (ADR-001 §B)
 *
 * The stable, versioned cross-capability envelope. Every enterprise event
 * carries identity, tenant, actor, correlation/causation, idempotency, source
 * module, and a typed payload. The transport treats `payload` as opaque JSON —
 * it holds NO business logic (ADR-001 §C).
 */

export type EnterpriseActorType = 'HUMAN' | 'AI_AGENT' | 'SYSTEM';

/**
 * Input a producer supplies to publish an event. `eventId`, `timestamp`, and
 * defaults are filled by the transport. `idempotencyKey` MUST be deterministic
 * for the business fact so a retry/re-publish does not enqueue twice.
 */
export interface PublishEventInput {
  eventType: string;
  version?: number; // default resolved from the registry
  tenantId: string;
  actorId?: string | null;
  actorType?: EnterpriseActorType;
  correlationId?: string; // generated if absent
  causationId?: string | null;
  idempotencyKey: string;
  sourceModule: string;
  payload: Record<string, unknown>;
}

/** The durable, delivered enterprise event as seen by consumers. */
export interface EnterpriseEvent {
  eventId: string; // outbox row id
  eventType: string;
  version: number;
  tenantId: string;
  actorId: string | null;
  actorType: EnterpriseActorType;
  correlationId: string;
  causationId: string | null;
  idempotencyKey: string;
  sourceModule: string;
  timestamp: string; // ISO 8601 (outbox createdAt)
  payload: Record<string, unknown>;
}

export type EnterpriseEventHandler = (
  event: EnterpriseEvent,
) => Promise<void> | void;
