/**
 * KnowledgeGraphSyncConsumer (Phase 9 honest remediation)
 *
 * Subscribes to entity lifecycle events from the enterprise event fabric and
 * synchronizes the knowledge graph accordingly. This closes the gap between
 * the phase-9 report (which claimed the graph was "operational") and the
 * reality: entities were never automatically added to the graph without an
 * explicit /refresh call.
 *
 * Event reactions:
 * - enterprise.project.created         → upsert PROJECT node + RELATED_TO customer edge
 * - enterprise.project.status.changed  → upsert PROJECT node (metadata sync)
 * - enterprise.task.completed         → upsert WORK_RUN node + PART_OF project edge
 * - enterprise.approval.requested     → upsert APPROVAL node + IMPACTS resource edge
 * - enterprise.approval.granted       → upsert APPROVAL node + IMPACTS resource edge
 * - enterprise.approval.rejected      → upsert APPROVAL node (status update)
 * - enterprise.workrun.created        → upsert WORK_RUN node + PART_OF mission edge
 * - enterprise.workrun.completed      → upsert WORK_RUN node (status update)
 *
 * SRP: only syncs entity state → knowledge graph
 * OCP: add new entity reactions without modifying existing handlers
 * DIP: depends on IKnowledgeGraph port, not concrete implementation
 */

import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { EnterpriseEvent } from '../../enterprise-events/contracts/enterprise-event.interface';
import { KNOWLEDGE_GRAPH } from '../contracts/enterprise-intelligence.interface';
import type { IKnowledgeGraph } from '../contracts/enterprise-intelligence.interface';

export const KNOWLEDGE_GRAPH_SYNC_CONSUMER_ID = 'knowledge-graph-sync';

interface ProjectCreatedPayload { projectId: string; name: string; customerId?: string; status: string; budgetAmount?: number }
interface ProjectStatusPayload { projectId: string; previousStatus: string; newStatus: string }
interface TaskCompletedPayload { taskId: string; title?: string; projectId?: string }
interface ApprovalRequestedPayload { approvalId: string; title: string; resourceType: string; resourceId: string; requestedBy?: string }
interface ApprovalResultPayload { approvalId: string; title: string; resourceType: string; resourceId: string; status: string }
interface WorkrunCreatedPayload { runId: string; title?: string; missionId?: string }
interface WorkrunCompletedPayload { runId: string; title?: string; status: string }

@Injectable()
export class KnowledgeGraphSyncConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(KnowledgeGraphSyncConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT) private readonly transport: IEnterpriseEventTransport,
    @Inject(KNOWLEDGE_GRAPH) private readonly graph: IKnowledgeGraph,
  ) {}

  onApplicationBootstrap(): void {
    this.transport.registerConsumer({
      consumerId: KNOWLEDGE_GRAPH_SYNC_CONSUMER_ID,
      eventTypes: [
        'enterprise.project.created',
        'enterprise.project.status.changed',
        'enterprise.task.completed',
        'enterprise.approval.requested',
        'enterprise.approval.granted',
        'enterprise.approval.rejected',
        'enterprise.workrun.created',
        'enterprise.workrun.completed',
      ],
      handler: (event) => this.handle(event),
    });
    this.logger.log('KnowledgeGraphSyncConsumer registered for entity lifecycle events');
  }

  private async handle(event: EnterpriseEvent): Promise<void> {
    switch (event.eventType) {
      case 'enterprise.project.created': await this.onProjectCreated(event); break;
      case 'enterprise.project.status.changed': await this.onProjectStatusChanged(event); break;
      case 'enterprise.task.completed': await this.onTaskCompleted(event); break;
      case 'enterprise.approval.requested': await this.onApprovalRequested(event); break;
      case 'enterprise.approval.granted': await this.onApprovalGranted(event); break;
      case 'enterprise.approval.rejected': await this.onApprovalRejected(event); break;
      case 'enterprise.workrun.created': await this.onWorkrunCreated(event); break;
      case 'enterprise.workrun.completed': await this.onWorkrunCompleted(event); break;
    }
  }

  async onProjectCreated(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as ProjectCreatedPayload;
    await this.graph.upsertNode(event.tenantId, 'PROJECT', p.projectId, p.name, {
      status: p.status,
      budget: p.budgetAmount,
    });
    if (p.customerId) {
      const projectNode = await this.graph.findNode(event.tenantId, 'PROJECT', p.projectId);
      const customerNode = await this.graph.upsertNode(event.tenantId, 'CUSTOMER', p.customerId, `Customer ${p.customerId}`);
      if (projectNode) {
        await this.graph.upsertEdge(event.tenantId, projectNode.id, customerNode.id, 'RELATED_TO', [
          { source: 'enterprise.project.created', reference: p.projectId, detail: `Project ${p.name} linked to customer ${p.customerId}` },
        ]);
      }
    }
    await this.emitKnowledgeUpdated(event);
  }

  async onProjectStatusChanged(event: EnterpriseEvent): Promise<void> {
    const p = event.payload as unknown as ProjectStatusPayload;
    const existing = await this.graph.findNode(event.tenantId, 'PROJECT', p.projectId);
    const label = existing?.label ?? p.projectId;
    await this.graph.upsertNode(event.tenantId, 'PROJECT', p.projectId, label, {
      previousStatus: p.previousStatus,
      newStatus: p.newStatus,
    });
    await this.emitKnowledgeUpdated(event);
  }

  async onTaskCompleted(event: EnterpriseEvent): Promise<void> {
    const t = event.payload as unknown as TaskCompletedPayload;
    await this.graph.upsertNode(event.tenantId, 'WORK_RUN', t.taskId, t.title ?? t.taskId, { status: 'COMPLETED' });
    if (t.projectId) {
      const taskNode = await this.graph.findNode(event.tenantId, 'WORK_RUN', t.taskId);
      const projectNode = await this.graph.findNode(event.tenantId, 'PROJECT', t.projectId);
      if (taskNode && projectNode) {
        await this.graph.upsertEdge(event.tenantId, taskNode.id, projectNode.id, 'PART_OF', [
          { source: 'enterprise.task.completed', reference: t.taskId, detail: `Task ${t.title} belongs to project ${t.projectId}` },
        ]);
      }
    }
    await this.emitKnowledgeUpdated(event);
  }

  async onApprovalRequested(event: EnterpriseEvent): Promise<void> {
    const a = event.payload as unknown as ApprovalRequestedPayload;
    await this.graph.upsertNode(event.tenantId, 'APPROVAL', a.approvalId, a.title, { resourceType: a.resourceType, resourceId: a.resourceId, status: 'PENDING' });
    await this.createApprovalResourceEdge(event.tenantId, a, 'PENDING');
    await this.emitKnowledgeUpdated(event);
  }

  async onApprovalGranted(event: EnterpriseEvent): Promise<void> {
    const a = event.payload as unknown as ApprovalResultPayload;
    await this.graph.upsertNode(event.tenantId, 'APPROVAL', a.approvalId, a.title, { resourceType: a.resourceType, resourceId: a.resourceId, status: 'GRANTED' });
    await this.createApprovalResourceEdge(event.tenantId, a, 'GRANTED');
    await this.emitKnowledgeUpdated(event);
  }

  async onApprovalRejected(event: EnterpriseEvent): Promise<void> {
    const a = event.payload as unknown as ApprovalResultPayload;
    await this.graph.upsertNode(event.tenantId, 'APPROVAL', a.approvalId, a.title, { resourceType: a.resourceType, resourceId: a.resourceId, status: 'REJECTED' });
    await this.emitKnowledgeUpdated(event);
  }

  async onWorkrunCreated(event: EnterpriseEvent): Promise<void> {
    const r = event.payload as unknown as WorkrunCreatedPayload;
    await this.graph.upsertNode(event.tenantId, 'WORK_RUN', r.runId, r.title ?? r.runId, { status: 'CREATED' });
    if (r.missionId) {
      const runNode = await this.graph.findNode(event.tenantId, 'WORK_RUN', r.runId);
      const missionNode = await this.graph.findNode(event.tenantId, 'MISSION', r.missionId);
      if (runNode && missionNode) {
        await this.graph.upsertEdge(event.tenantId, runNode.id, missionNode.id, 'PART_OF', [
          { source: 'enterprise.workrun.created', reference: r.runId, detail: `WorkRun ${r.title} belongs to mission ${r.missionId}` },
        ]);
      }
    }
    await this.emitKnowledgeUpdated(event);
  }

  async onWorkrunCompleted(event: EnterpriseEvent): Promise<void> {
    const r = event.payload as unknown as WorkrunCompletedPayload;
    await this.graph.upsertNode(event.tenantId, 'WORK_RUN', r.runId, r.title ?? r.runId, { status: r.status });
    await this.emitKnowledgeUpdated(event);
  }

  private async createApprovalResourceEdge(tenantId: string, a: ApprovalRequestedPayload | ApprovalResultPayload, status: string): Promise<void> {
    const approvalNode = await this.graph.findNode(tenantId, 'APPROVAL', a.approvalId);
    const resourceNode = await this.graph.findNode(tenantId, 'PROJECT', a.resourceId)
      ?? await this.graph.findNode(tenantId, 'WORK_RUN', a.resourceId);
    if (approvalNode && resourceNode) {
      await this.graph.upsertEdge(tenantId, approvalNode.id, resourceNode.id, 'IMPACTS', [
        { source: `enterprise.approval.${status.toLowerCase()}`, reference: a.approvalId, detail: `Approval ${a.title} impacts ${a.resourceType} ${a.resourceId}` },
      ]);
    }
  }

  private async emitKnowledgeUpdated(event: EnterpriseEvent): Promise<void> {
    await this.transport.publish({
      eventType: 'enterprise.knowledge.updated',
      version: 1,
      tenantId: event.tenantId,
      actorId: event.actorId ?? 'system',
      idempotencyKey: `knowledge:${event.tenantId}:updated:${event.eventId}`,
      sourceModule: 'EnterpriseIntelligenceNetwork',
      payload: { triggeredBy: event.eventType },
    }).catch((err) => this.logger.warn(`Failed to emit enterprise.knowledge.updated: ${err}`));
  }
}
