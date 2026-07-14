/**
 * Deterministic Test Consumer (Phase 2 §11).
 *
 * Subscribes to a dedicated test event type and behaves deterministically so
 * integration/failure tests can prove: success, intentional failure, success
 * after retry, retry exhaustion → dead-letter, replay, and idempotency.
 *
 * It is NOT a proxy for any future business capability. It reads its directive
 * from the event payload:
 *   payload.mode = 'succeed' | 'fail' | 'fail-until:<n>' | 'count'
 *
 * Guarded behind ENTERPRISE_EVENTS_TEST_CONSUMER so it is inert in production
 * unless explicitly enabled.
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import { EVENT_TRANSPORT } from '../contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../contracts/enterprise-event-transport.interface';
import type { EnterpriseEvent } from '../contracts/enterprise-event.interface';
import { IdempotencyService } from '../idempotency/idempotency.service';

export const TEST_CONSUMER_ID = 'fabric-test-consumer';
export const TEST_EVENT_TYPE = 'enterprise.task.completed'; // reuse a registered type for tests

@Injectable()
export class TestConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(TestConsumer.name);

  /** Observable side-effect counter for idempotency tests. */
  readonly effects = new Map<string, number>();
  private attempts = new Map<string, number>();

  constructor(
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    private readonly idempotency: IdempotencyService,
  ) {}

  onApplicationBootstrap(): void {
    if (process.env.ENTERPRISE_EVENTS_TEST_CONSUMER !== 'true') return;
    this.register();
  }

  /** Exposed for tests to register without the env flag. */
  register(): void {
    this.transport.registerConsumer({
      consumerId: TEST_CONSUMER_ID,
      eventTypes: [TEST_EVENT_TYPE],
      handler: (event) => this.handle(event),
    });
  }

  private async handle(event: EnterpriseEvent): Promise<void> {
    const mode = String(event.payload.mode ?? 'succeed');

    if (mode === 'fail') {
      throw new Error('TestConsumer: intentional failure');
    }

    if (mode.startsWith('fail-until:')) {
      const threshold = Number(mode.split(':')[1] ?? '1');
      const n = (this.attempts.get(event.idempotencyKey) ?? 0) + 1;
      this.attempts.set(event.idempotencyKey, n);
      if (n < threshold) {
        throw new Error(
          `TestConsumer: failing attempt ${n} (< ${threshold})`,
        );
      }
      this.bump(event);
      return;
    }

    if (mode === 'count') {
      // Prove business-effect idempotency: only increment once per key even if
      // delivered multiple times.
      await this.idempotency.runOnce(
        event.idempotencyKey,
        TEST_CONSUMER_ID,
        event.tenantId,
        async () => this.bump(event),
      );
      return;
    }

    // default: succeed
    this.bump(event);
  }

  private bump(event: EnterpriseEvent): void {
    this.effects.set(
      event.idempotencyKey,
      (this.effects.get(event.idempotencyKey) ?? 0) + 1,
    );
  }
}
