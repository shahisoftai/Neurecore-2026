/**
 * Event contract validation — unit tests (Phase 2 §16 unit: event validation).
 */

import {
  validatePublishInput,
  EventContractValidationError,
} from './event-contract.validator';
import type { PublishEventInput } from '../contracts/enterprise-event.interface';

function base(): PublishEventInput {
  return {
    eventType: 'enterprise.project.created',
    tenantId: 't1',
    actorType: 'SYSTEM',
    idempotencyKey: 'k1',
    sourceModule: 'projects',
    payload: { projectId: 'p1', name: 'X' },
  };
}

describe('validatePublishInput', () => {
  it('accepts a well-formed event', () => {
    expect(() => validatePublishInput(base())).not.toThrow();
  });

  it('rejects unknown event type', () => {
    expect(() =>
      validatePublishInput({ ...base(), eventType: 'enterprise.not.real' }),
    ).toThrow(EventContractValidationError);
  });

  it('rejects unsupported version', () => {
    expect(() => validatePublishInput({ ...base(), version: 99 })).toThrow(
      /unsupported version/,
    );
  });

  it('rejects missing tenantId', () => {
    expect(() =>
      validatePublishInput({ ...base(), tenantId: '' }),
    ).toThrow(/missing tenantId/);
  });

  it('rejects missing idempotencyKey', () => {
    expect(() =>
      validatePublishInput({ ...base(), idempotencyKey: '' }),
    ).toThrow(/missing idempotencyKey/);
  });

  it('rejects a non-SYSTEM actor without actorId', () => {
    expect(() =>
      validatePublishInput({ ...base(), actorType: 'HUMAN', actorId: null }),
    ).toThrow(/actorId required/);
  });

  it('rejects malformed payload', () => {
    expect(() =>
      validatePublishInput({
        ...base(),
        payload: null as unknown as Record<string, unknown>,
      }),
    ).toThrow(/malformed payload/);
  });

  it('rejects payload missing a required key', () => {
    expect(() =>
      validatePublishInput({ ...base(), payload: { projectId: 'p1' } }),
    ).toThrow(/missing required key "name"/);
  });

  it('rejects invalid causationId type', () => {
    expect(() =>
      validatePublishInput({
        ...base(),
        causationId: 123 as unknown as string,
      }),
    ).toThrow(/invalid causationId/);
  });
});
