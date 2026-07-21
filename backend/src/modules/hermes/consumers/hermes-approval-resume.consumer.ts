/**
 * HermesApprovalResumeConsumer (Phase 4.2, 2026-07-20).
 *
 * Subscribes to enterprise.approval.granted / .rejected. When an approval
 * with resourceType='HERMES_TOOL_CALL' is decided, it looks up the
 * suspended tool call in HermesRuntimeService and clears it (for grants) or
 * marks the agent as denied (for rejections).
 *
 * Idempotent: duplicate events are no-ops because the suspendedCalls map
 * is cleared on first decision.
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
import { HermesRuntimeService } from '../services/hermes-runtime.service';

export const HERMES_APPROVAL_CONSUMER_ID = 'hermes-approval-resume';

@Injectable()
export class HermesApprovalResumeConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(HermesApprovalResumeConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    private readonly runtime: HermesRuntimeService,
  ) {}

  onApplicationBootstrap(): void {
    this.transport.registerConsumer({
      consumerId: HERMES_APPROVAL_CONSUMER_ID,
      eventTypes: ['enterprise.approval.granted', 'enterprise.approval.rejected'],
      handler: (event) => this.handle(event),
    });
    this.logger.log(
      'HermesApprovalResumeConsumer registered for enterprise.approval.{granted,rejected}',
    );
  }

  private async handle(event: EnterpriseEvent): Promise<void> {
    const resourceType = String(event.payload?.resourceType ?? '');
    if (resourceType !== 'HERMES_TOOL_CALL') return; // not ours

    const approvalId = String(event.payload?.approvalId ?? '');
    if (!approvalId) return;

    const decision: 'granted' | 'rejected' = event.eventType.endsWith('granted')
      ? 'granted'
      : 'rejected';

    try {
      const result = await this.runtime.resumeFromApproval(approvalId, decision);
      this.logger.log(
        `Hermes approval ${approvalId} (${decision}) → ${result.status}${result.toolName ? ` [${result.toolName}]` : ''}`,
      );
    } catch (err) {
      this.logger.warn(
        `Hermes resume from approval ${approvalId} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
