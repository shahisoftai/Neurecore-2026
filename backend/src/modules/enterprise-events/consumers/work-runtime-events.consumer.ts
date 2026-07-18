/**
 * WorkRuntimeEventsConsumer (Phase 10 honest remediation)
 *
 * Subscribes to work run and task lifecycle events from the enterprise event
 * fabric and emits typed Socket.IO events to the browser UI.
 *
 * The EventsGateway has typed helpers (emitTaskStarted, emitTaskCompleted,
 * emitWorkflowStatusChanged) that were defined but NEVER called anywhere
 * in the codebase. This consumer activates them.
 *
 * Event → Socket.IO mapping:
 * - enterprise.workrun.created        → workflow:status_changed { status: 'CREATED' }
 * - enterprise.workrun.started       → workflow:status_changed { status: 'STARTED' }
 * - enterprise.workrun.completed      → workflow:status_changed { status: 'COMPLETED' }
 * - enterprise.workrun.failed          → workflow:status_changed { status: 'FAILED', error: reason }
 * - enterprise.workrun.paused         → workflow:status_changed { status: 'PAUSED' }
 * - enterprise.workrun.resumed         → workflow:status_changed { status: 'RESUMED' }
 * - enterprise.workrun.cancelled       → workflow:status_changed { status: 'CANCELLED' }
 * - enterprise.workrun.approval.requested → workflow:status_changed { status: 'AWAITING_APPROVAL' }
 * - enterprise.workrun.step.started    → task:started { taskId: stepId, agentId }
 * - enterprise.workrun.step.succeeded  → task:completed { taskId: stepId, agentId, success: true }
 * - enterprise.workrun.step.failed     → task:completed { taskId: stepId, agentId, success: false, error }
 * - enterprise.task.completed         → task:completed { taskId, success: true }
 *
 * Socket.IO failure is non-fatal (durable processing unaffected).
 *
 * SRP: only maps work-runtime events → typed Socket.IO events
 * OCP: add new event → typed event mappings without modifying existing handlers
 * DIP: depends on IEnterpriseEventTransport port, injected EventsGateway (same pattern as UiProjectionConsumer)
 */

import { Injectable, Logger, OnApplicationBootstrap, Inject } from '@nestjs/common';
import { EVENT_TRANSPORT } from '../contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../contracts/enterprise-event-transport.interface';
import type { EnterpriseEvent } from '../contracts/enterprise-event.interface';
import { EventsGateway } from '../../events/events.gateway';

export const WORK_RUNTIME_EVENTS_CONSUMER_ID = 'work-runtime-events';

interface WorkrunCreatedPayload { runId: string; title?: string; missionId?: string }
interface WorkrunStatusPayload { runId: string; reason?: string }
interface WorkrunFailedPayload { runId: string; failureCode?: string; reason?: string }
interface WorkrunStepPayload { runId: string; stepId: string; agentId?: string }
interface WorkrunStepFailedPayload { runId: string; stepId: string; agentId?: string; error?: string }
interface WorkrunApprovalPayload { runId: string; approvalId: string }
interface TaskCompletedPayload { taskId: string; title?: string; projectId?: string; goalId?: string; status: string }

@Injectable()
export class WorkRuntimeEventsConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(WorkRuntimeEventsConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    private readonly gateway: EventsGateway,
  ) {}

  onApplicationBootstrap(): void {
    this.transport.registerConsumer({
      consumerId: WORK_RUNTIME_EVENTS_CONSUMER_ID,
      eventTypes: [
        'enterprise.workrun.created',
        'enterprise.workrun.started',
        'enterprise.workrun.completed',
        'enterprise.workrun.failed',
        'enterprise.workrun.paused',
        'enterprise.workrun.resumed',
        'enterprise.workrun.cancelled',
        'enterprise.workrun.approval.requested',
        'enterprise.workrun.step.started',
        'enterprise.workrun.step.succeeded',
        'enterprise.workrun.step.failed',
        'enterprise.task.completed',
      ],
      handler: (event) => this.handle(event),
    });
    this.logger.log('WorkRuntimeEventsConsumer registered for work-runtime and task events');
  }

  private async handle(event: EnterpriseEvent): Promise<void> {
    switch (event.eventType) {
      case 'enterprise.workrun.created': await this.onWorkrunCreated(event); break;
      case 'enterprise.workrun.started': await this.onWorkrunStarted(event); break;
      case 'enterprise.workrun.completed': await this.onWorkrunCompleted(event); break;
      case 'enterprise.workrun.failed': await this.onWorkrunFailed(event); break;
      case 'enterprise.workrun.paused': await this.onWorkrunPaused(event); break;
      case 'enterprise.workrun.resumed': await this.onWorkrunResumed(event); break;
      case 'enterprise.workrun.cancelled': await this.onWorkrunCancelled(event); break;
      case 'enterprise.workrun.approval.requested': await this.onWorkrunApprovalRequested(event); break;
      case 'enterprise.workrun.step.started': await this.onWorkrunStepStarted(event); break;
      case 'enterprise.workrun.step.succeeded': await this.onWorkrunStepSucceeded(event); break;
      case 'enterprise.workrun.step.failed': await this.onWorkrunStepFailed(event); break;
      case 'enterprise.task.completed': await this.onTaskCompleted(event); break;
    }
  }

  private emitToTenant(tenantId: string, event: string, data: unknown): void {
    try {
      this.gateway.emitToTenant(tenantId, event, data);
    } catch (err) {
      this.logger.warn(`Socket.IO emit failed for ${event} (durable processing unaffected): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async onWorkrunCreated(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunCreatedPayload;
    this.emitToTenant(event.tenantId, 'workflow:status_changed', {
      workflowId: p.runId,
      status: 'CREATED',
      ...(p.title ? { title: p.title } : {}),
      timestamp: Date.now(),
    });
  }

  private async onWorkrunStarted(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunStatusPayload;
    this.emitToTenant(event.tenantId, 'workflow:status_changed', {
      workflowId: p.runId,
      status: 'STARTED',
      timestamp: Date.now(),
    });
  }

  private async onWorkrunCompleted(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunStatusPayload;
    this.emitToTenant(event.tenantId, 'workflow:status_changed', {
      workflowId: p.runId,
      status: 'COMPLETED',
      timestamp: Date.now(),
    });
  }

  private async onWorkrunFailed(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunFailedPayload;
    this.emitToTenant(event.tenantId, 'workflow:status_changed', {
      workflowId: p.runId,
      status: 'FAILED',
      ...(p.reason ? { error: p.reason } : {}),
      timestamp: Date.now(),
    });
  }

  private async onWorkrunPaused(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunStatusPayload;
    this.emitToTenant(event.tenantId, 'workflow:status_changed', {
      workflowId: p.runId,
      status: 'PAUSED',
      timestamp: Date.now(),
    });
  }

  private async onWorkrunResumed(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunStatusPayload;
    this.emitToTenant(event.tenantId, 'workflow:status_changed', {
      workflowId: p.runId,
      status: 'RESUMED',
      timestamp: Date.now(),
    });
  }

  private async onWorkrunCancelled(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunStatusPayload;
    this.emitToTenant(event.tenantId, 'workflow:status_changed', {
      workflowId: p.runId,
      status: 'CANCELLED',
      timestamp: Date.now(),
    });
  }

  private async onWorkrunApprovalRequested(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunApprovalPayload;
    this.emitToTenant(event.tenantId, 'workflow:status_changed', {
      workflowId: p.runId,
      status: 'AWAITING_APPROVAL',
      ...(p.approvalId ? { approvalId: p.approvalId } : {}),
      timestamp: Date.now(),
    });
  }

  private async onWorkrunStepStarted(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunStepPayload;
    try {
      this.gateway.emitTaskStarted(event.tenantId, p.stepId, p.agentId ?? 'SYSTEM');
    } catch (err) {
      this.logger.warn(`Socket.IO emit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async onWorkrunStepSucceeded(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunStepPayload;
    try {
      this.gateway.emitTaskCompleted(event.tenantId, p.stepId, p.agentId ?? 'SYSTEM', true);
    } catch (err) {
      this.logger.warn(`Socket.IO emit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async onWorkrunStepFailed(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as WorkrunStepFailedPayload;
    try {
      this.gateway.emitTaskCompleted(event.tenantId, p.stepId, p.agentId ?? 'SYSTEM', false, p.error);
    } catch (err) {
      this.logger.warn(`Socket.IO emit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async onTaskCompleted(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as TaskCompletedPayload;
    try {
      this.gateway.emitTaskCompleted(event.tenantId, p.taskId, 'SYSTEM', true);
    } catch (err) {
      this.logger.warn(`Socket.IO emit failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }
}
