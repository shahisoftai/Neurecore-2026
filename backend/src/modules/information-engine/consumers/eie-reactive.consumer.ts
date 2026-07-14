/**
 * EIE Reactive Consumer (Phase 2 §11) — capability-owned by information-engine.
 *
 * Reacts to cross-capability enterprise events by triggering Continuous
 * Discovery reassessment. It does NOT duplicate completeness logic — it calls
 * the existing ProjectCompletenessService.recomputeForProject (Phase 1.1),
 * which is the single owner of the resolve→recompute sequence.
 *
 * Reaction: on enterprise.project.status.changed, recompute the project's
 * completeness so the organizational state stays fresh after a lifecycle move.
 * Idempotent per event via IdempotencyService.
 *
 * This consumer lives in the reacting capability (information-engine) and
 * depends only on the transport PORT — never on the concrete fabric class
 * (ADR-001 DIP; enforced by architecture tests).
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
import { IdempotencyService } from '../../enterprise-events/idempotency/idempotency.service';
import { ProjectCompletenessService } from '../clients/project-completeness.service';

export const EIE_REACTIVE_CONSUMER_ID = 'eie-continuous-discovery';

@Injectable()
export class EieReactiveConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(EieReactiveConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    private readonly idempotency: IdempotencyService,
    private readonly completeness: ProjectCompletenessService,
  ) {}

  onApplicationBootstrap(): void {
    this.transport.registerConsumer({
      consumerId: EIE_REACTIVE_CONSUMER_ID,
      eventTypes: ['enterprise.project.status.changed'],
      handler: (event) => this.handle(event),
    });
  }

  private async handle(event: EnterpriseEvent): Promise<void> {
    const projectId = String(event.payload.projectId ?? '');
    if (!projectId) return;

    await this.idempotency.runOnce(
      event.idempotencyKey,
      EIE_REACTIVE_CONSUMER_ID,
      event.tenantId,
      async () => {
        // Delegate to the single completeness owner — no duplicated logic.
        await this.completeness.recomputeForProject(projectId, event.tenantId);
        this.logger.debug(
          `Continuous Discovery reassessment for project ${projectId} after status change`,
        );
      },
    );
  }
}
