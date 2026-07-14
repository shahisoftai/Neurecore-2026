/**
 * ContextCacheInvalidationConsumer (Phase 3, ADR-002 §12).
 *
 * Subscribes to Phase-2 enterprise events and invalidates Context Plane cache
 * entries — tenant-scoped and capability-scoped. It performs NO capability
 * business logic; it only maps an event type to the capability cache to clear.
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { EnterpriseEvent } from '../../enterprise-events/contracts/enterprise-event.interface';
import { ContextCache } from '../cache/context-cache.service';

export const CONTEXT_INVALIDATION_CONSUMER_ID = 'context-plane-invalidation';

// Map event type → capability caches to invalidate for the event's tenant.
const EVENT_TO_CAPABILITIES: Record<string, string[]> = {
  'enterprise.project.created': ['projects'],
  'enterprise.project.status.changed': ['projects'],
  'enterprise.project.budget.changed': ['projects', 'finance'],
  'enterprise.project.timeline.changed': ['projects'],
  'enterprise.eie.response.recorded': ['projects'],
  'enterprise.eie.completeness.changed': ['projects'],
  'enterprise.task.completed': ['tasks'],
  'enterprise.approval.requested': ['approvals'],
  'enterprise.approval.granted': ['approvals'],
  'enterprise.approval.rejected': ['approvals'],
  'enterprise.finance.threshold.exceeded': ['finance'],
  'enterprise.customer.communication.received': ['comms', 'customers'],
};

@Injectable()
export class ContextCacheInvalidationConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(ContextCacheInvalidationConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT)
    private readonly transport: IEnterpriseEventTransport,
    private readonly cache: ContextCache,
  ) {}

  onApplicationBootstrap(): void {
    const types = Object.keys(EVENT_TO_CAPABILITIES);
    this.transport.registerConsumer({
      consumerId: CONTEXT_INVALIDATION_CONSUMER_ID,
      eventTypes: types,
      handler: (event) => this.handle(event),
    });
  }

  private handle(event: EnterpriseEvent): void {
    const caps = EVENT_TO_CAPABILITIES[event.eventType];
    if (!caps) return;
    for (const cap of caps) {
      // Tenant-scoped + capability-scoped invalidation. No business logic.
      this.cache.invalidate(event.tenantId, cap);
    }
    this.logger.debug(
      `Invalidated context caches [${caps.join(', ')}] for tenant ${event.tenantId} on ${event.eventType}`,
    );
  }
}
