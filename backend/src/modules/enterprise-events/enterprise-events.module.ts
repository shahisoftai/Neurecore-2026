/**
 * EnterpriseEventsModule — the durable Enterprise Event Fabric (ADR-001).
 *
 * @Global so the EVENT_TRANSPORT port + IdempotencyService are injectable by
 * any capability (producers publish; consumers register) without import edges
 * that would risk circular module dependencies. Capabilities depend only on the
 * EVENT_TRANSPORT symbol (the port), never on the concrete transport class
 * (enforced by architecture tests / ADR-001 DIP).
 *
 * Fabric-owned consumers (audit, UI projection, deterministic test) live here
 * because they are infrastructure/observability concerns of the fabric itself.
 * Business-capability consumers (e.g. EIE reactive) live inside their OWN
 * capability module and depend on the transport port.
 */

import { Global, Module, OnApplicationBootstrap } from '@nestjs/common';
import { DatabaseModule } from '../../infrastructure/database/database.module';
import { EventsModule } from '../events/events.module';
import { EnterpriseEventTransport } from './transport/enterprise-event-transport.service';
import { EVENT_TRANSPORT } from './contracts/enterprise-event-transport.interface';
import { IdempotencyService } from './idempotency/idempotency.service';
import { AuditConsumer } from './consumers/audit.consumer';
import { UiProjectionConsumer } from './consumers/ui-projection.consumer';
import { TestConsumer } from './consumers/test.consumer';
import { WorkRuntimeEventsConsumer } from './consumers/work-runtime-events.consumer';
import { EnterpriseEventsAdminController } from './enterprise-events-admin.controller';

@Global()
@Module({
  imports: [DatabaseModule, EventsModule],
  controllers: [EnterpriseEventsAdminController],
  providers: [
    EnterpriseEventTransport,
    { provide: EVENT_TRANSPORT, useExisting: EnterpriseEventTransport },
    IdempotencyService,
    AuditConsumer,
    UiProjectionConsumer,
    TestConsumer,
    WorkRuntimeEventsConsumer,
  ],
  exports: [EVENT_TRANSPORT, EnterpriseEventTransport, IdempotencyService],
})
export class EnterpriseEventsModule implements OnApplicationBootstrap {
  constructor(private readonly transport: EnterpriseEventTransport) {}

  onApplicationBootstrap(): void {
    // Consumers self-register in their own OnApplicationBootstrap; workers start
    // after the DI graph + registrations are in place.
    this.transport.startWorkers();
  }
}
