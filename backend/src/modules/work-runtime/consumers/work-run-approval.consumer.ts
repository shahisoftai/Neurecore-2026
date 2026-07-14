/**
 * WorkRunApprovalConsumer (Phase 4 §11, ADR-006).
 *
 * Subscribes to enterprise.approval.granted / .rejected. When an approval that
 * belongs to a WORK_RUN_STEP is decided, it resumes the owning run (which
 * re-evaluates governance before executing the approved step). Idempotent:
 * duplicate approval events do not double-execute (run status + step claim +
 * idempotency key guard against it).
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
import { WORK_RUNTIME } from '../contracts/work-runtime.interface';
import type { IWorkRuntime } from '../contracts/work-runtime.interface';
import { WorkRunRepository } from '../repository/work-run.repository';

export const WORKRUN_APPROVAL_CONSUMER_ID = 'work-runtime-approval-resume';

@Injectable()
export class WorkRunApprovalConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkRunApprovalConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    @Inject(WORK_RUNTIME) private readonly runtime: IWorkRuntime,
    private readonly repo: WorkRunRepository,
  ) {}

  onApplicationBootstrap(): void {
    this.transport.registerConsumer({
      consumerId: WORKRUN_APPROVAL_CONSUMER_ID,
      eventTypes: ['enterprise.approval.granted', 'enterprise.approval.rejected'],
      handler: (event) => this.handle(event),
    });
  }

  private async handle(event: EnterpriseEvent): Promise<void> {
    const resourceType = String(event.payload.resourceType ?? '');
    if (resourceType !== 'WORK_RUN_STEP') return; // not ours

    const approvalId = String(event.payload.approvalId ?? '');
    if (!approvalId) return;

    // Find the step (tenant-scoped) that this approval belongs to.
    const step = await this.repo.findStepByApproval(approvalId, event.tenantId);
    if (!step) {
      this.logger.debug(`No work-run step for approval ${approvalId} (tenant ${event.tenantId})`);
      return;
    }

    // Resume the run — the runtime re-validates the approval + governance before
    // executing. Idempotent: if already resumed/completed, resume() is a no-op.
    try {
      await this.runtime.resume(step.runId, event.tenantId);
      this.logger.debug(
        `Resumed work run ${step.runId} after approval ${approvalId} (${event.eventType})`,
      );
    } catch (e) {
      this.logger.warn(
        `Resume after approval ${approvalId} failed: ${e instanceof Error ? e.message : e}`,
      );
    }
  }
}
