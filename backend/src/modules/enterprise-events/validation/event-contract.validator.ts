/**
 * Event contract validation (ADR-001 §14).
 *
 * Rejects, BEFORE the event enters the outbox:
 *   - unknown event type
 *   - unsupported version
 *   - missing tenant id
 *   - missing actor (actorType required; actorId may be null only for SYSTEM)
 *   - malformed / missing required payload keys
 *   - missing idempotency key
 *   - invalid correlation/causation structure
 *
 * Validation failure throws a visible error — the event is never silently
 * dropped.
 */

import type { PublishEventInput } from '../contracts/enterprise-event.interface';
import { getEventContract } from '../contracts/enterprise-event-registry';

export class EventContractValidationError extends Error {
  constructor(
    public readonly reason: string,
    public readonly eventType: string,
  ) {
    super(`Event contract validation failed for "${eventType}": ${reason}`);
    this.name = 'EventContractValidationError';
  }
}

const VALID_ACTOR_TYPES = ['HUMAN', 'AI_AGENT', 'SYSTEM'];

export function validatePublishInput(input: PublishEventInput): void {
  const t = input.eventType;

  const contract = getEventContract(t);
  if (!contract) {
    throw new EventContractValidationError('unknown event type', t ?? '(none)');
  }

  if (input.version != null && input.version !== contract.version) {
    throw new EventContractValidationError(
      `unsupported version ${input.version} (registry has ${contract.version})`,
      t,
    );
  }

  if (!input.tenantId || typeof input.tenantId !== 'string') {
    throw new EventContractValidationError('missing tenantId', t);
  }

  const actorType = input.actorType ?? 'SYSTEM';
  if (!VALID_ACTOR_TYPES.includes(actorType)) {
    throw new EventContractValidationError(
      `invalid actorType "${actorType}"`,
      t,
    );
  }
  if (actorType !== 'SYSTEM' && !input.actorId) {
    throw new EventContractValidationError(
      `actorId required for actorType ${actorType}`,
      t,
    );
  }

  if (!input.idempotencyKey || typeof input.idempotencyKey !== 'string') {
    throw new EventContractValidationError('missing idempotencyKey', t);
  }

  if (!input.sourceModule || typeof input.sourceModule !== 'string') {
    throw new EventContractValidationError('missing sourceModule', t);
  }

  if (input.payload == null || typeof input.payload !== 'object') {
    throw new EventContractValidationError('malformed payload', t);
  }

  if (input.causationId != null && typeof input.causationId !== 'string') {
    throw new EventContractValidationError('invalid causationId', t);
  }
  if (input.correlationId != null && typeof input.correlationId !== 'string') {
    throw new EventContractValidationError('invalid correlationId', t);
  }

  for (const key of contract.requiredPayloadKeys) {
    if (!(key in input.payload)) {
      throw new EventContractValidationError(
        `payload missing required key "${key}"`,
        t,
      );
    }
  }
}
