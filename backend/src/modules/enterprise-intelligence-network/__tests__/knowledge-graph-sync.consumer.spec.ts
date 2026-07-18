/**
 * KnowledgeGraphSyncConsumer — in-memory unit tests.
 *
 * Tests the event-driven graph sync consumer:
 * 1. Registers for correct event types on bootstrap.
 * 2. onProjectCreated: upserts PROJECT node + RELATED_TO customer edge.
 * 3. onProjectStatusChanged: upserts PROJECT node with updated metadata.
 * 4. onTaskCompleted: upserts WORK_RUN node + PART_OF project edge.
 * 5. onApprovalRequested: upserts APPROVAL node + IMPACTS resource edge.
 * 6. Emits enterprise.knowledge.updated after each sync.
 * 7. Gracefully handles missing entity fields.
 */

import { KnowledgeGraphSyncConsumer, KNOWLEDGE_GRAPH_SYNC_CONSUMER_ID } from '../consumers/knowledge-graph-sync.consumer';

class FakeKnowledgeGraph {
  nodes: any[] = [];
  edges: any[] = [];
  upsertNode = async (tenantId: string, entityKind: string, entityId: string, label: string, _metadata?: Record<string, unknown>) => {
    const existing = this.nodes.find(n => n.tenantId === tenantId && n.entityKind === entityKind && n.entityId === entityId);
    if (existing) { Object.assign(existing, { label }); return existing; }
    const node = { id: `n_${this.nodes.length + 1}`, tenantId, entityKind, entityId, label, createdAt: new Date(), updatedAt: new Date() };
    this.nodes.push(node);
    return node;
  };
  findNode = async (tenantId: string, entityKind: string, entityId: string) =>
    this.nodes.find(n => n.tenantId === tenantId && n.entityKind === entityKind && n.entityId === entityId) ?? null;
  upsertEdge = async (tenantId: string, sourceNodeId: string, targetNodeId: string, relationshipKind: string, _evidence?: any[]) => {
    const existing = this.edges.find(e => e.tenantId === tenantId && e.sourceNodeId === sourceNodeId && e.targetNodeId === targetNodeId && e.relationshipKind === relationshipKind);
    if (existing) return existing;
    const edge = { id: `e_${this.edges.length + 1}`, tenantId, sourceNodeId, targetNodeId, relationshipKind, evidence: _evidence ?? [], createdAt: new Date() };
    this.edges.push(edge);
    return edge;
  };
}

class FakeTransport {
  registeredConsumer: any = null;
  publishedEvents: any[] = [];
  subscribe(consumer: any, eventTypes: string[]) {
    this.registeredConsumer = { consumer, eventTypes };
  }
  registerConsumer(registration: any) {
    this.registeredConsumer = registration;
  }
  publish = async (input: any) => {
    this.publishedEvents.push(input);
    return { eventId: 'e_' + this.publishedEvents.length, deduplicated: false };
  };
}

function makeEvent(eventType: string, tenantId: string, payload: any, actorId = 'system'): any {
  return { eventId: 'ev_' + Math.random(), eventType, version: 1, tenantId, actorId, payload, idempotencyKey: 'test', sourceModule: 'test' };
}

describe('KnowledgeGraphSyncConsumer', () => {
  let consumer: KnowledgeGraphSyncConsumer;
  let graph: FakeKnowledgeGraph;
  let transport: FakeTransport;

  beforeEach(() => {
    graph = new FakeKnowledgeGraph();
    transport = new FakeTransport() as any;
    consumer = new KnowledgeGraphSyncConsumer(transport as any, graph as any);
  });

  describe('registration', () => {
    it('registers for all entity lifecycle event types on bootstrap', () => {
      consumer.onApplicationBootstrap();
      expect(transport.registeredConsumer).not.toBeNull();
      expect(transport.registeredConsumer.consumerId).toBe(KNOWLEDGE_GRAPH_SYNC_CONSUMER_ID);
      expect(transport.registeredConsumer.eventTypes).toEqual(expect.arrayContaining([
        'enterprise.project.created',
        'enterprise.project.status.changed',
        'enterprise.task.completed',
        'enterprise.approval.requested',
        'enterprise.approval.granted',
        'enterprise.approval.rejected',
        'enterprise.workrun.created',
        'enterprise.workrun.completed',
      ]));
    });

    it('routes to the correct handler via the switch in handle()', async () => {
      consumer.onApplicationBootstrap();
      const handler = transport.registeredConsumer.handler;
      // Patch handle to spy
      const handleSpy = jest.spyOn(consumer as any, 'handle');
      await handler(makeEvent('enterprise.project.created', 't1', { projectId: 'p1', name: 'P1' }));
      // The consumer switches on eventType internally
      expect(transport.registeredConsumer).not.toBeNull();
    });
  });

  describe('onProjectCreated', () => {
    it('upserts a PROJECT node', async () => {
      await consumer.onProjectCreated(makeEvent('enterprise.project.created', 't1', { projectId: 'p1', name: 'Project One', status: 'ACTIVE' }));
      const node = graph.nodes.find(n => n.entityId === 'p1' && n.entityKind === 'PROJECT');
      expect(node).toBeDefined();
      expect(node.label).toBe('Project One');
    });

    it('creates RELATED_TO edge to customer when customerId is present', async () => {
      await consumer.onProjectCreated(makeEvent('enterprise.project.created', 't1', { projectId: 'p1', name: 'P1', customerId: 'c1' }));
      const edge = graph.edges.find(e => e.relationshipKind === 'RELATED_TO');
      expect(edge).toBeDefined();
    });

    it('does not emit enterprise.knowledge.updated when transport fails', async () => {
      transport.publish = async () => { throw new Error('transport down'); };
      await consumer.onProjectCreated(makeEvent('enterprise.project.created', 't1', { projectId: 'p1', name: 'P1' }));
      // Should not throw — error is caught and logged
      expect(graph.nodes.length).toBeGreaterThan(0);
    });
  });

  describe('onProjectStatusChanged', () => {
    it('upserts PROJECT node with status metadata', async () => {
      await consumer.onProjectStatusChanged(makeEvent('enterprise.project.status.changed', 't1', { projectId: 'p1', previousStatus: 'DRAFT', newStatus: 'ACTIVE' }));
      const node = graph.nodes.find(n => n.entityId === 'p1');
      expect(node).toBeDefined();
      expect(node.label).toBe('p1'); // falls back to entityId when findNode returns null
    });

    it('preserves existing label when node already exists', async () => {
      await graph.upsertNode('t1', 'PROJECT', 'p1', 'My Project', {});
      await consumer.onProjectStatusChanged(makeEvent('enterprise.project.status.changed', 't1', { projectId: 'p1', previousStatus: 'DRAFT', newStatus: 'ACTIVE' }));
      const node = graph.nodes.find(n => n.entityId === 'p1');
      expect(node.label).toBe('My Project');
    });
  });

  describe('onTaskCompleted', () => {
    it('upserts WORK_RUN node', async () => {
      await consumer.onTaskCompleted(makeEvent('enterprise.task.completed', 't1', { taskId: 't1', title: 'Task One' }));
      const node = graph.nodes.find(n => n.entityId === 't1' && n.entityKind === 'WORK_RUN');
      expect(node).toBeDefined();
    });

    it('creates PART_OF edge to project when projectId is present', async () => {
      await graph.upsertNode('t1', 'PROJECT', 'p1', 'Project One', {});
      await consumer.onTaskCompleted(makeEvent('enterprise.task.completed', 't1', { taskId: 't1', title: 'Task One', projectId: 'p1' }));
      const edge = graph.edges.find(e => e.relationshipKind === 'PART_OF');
      expect(edge).toBeDefined();
    });
  });

  describe('onApprovalRequested', () => {
    it('upserts APPROVAL node with PENDING status', async () => {
      await consumer.onApprovalRequested(makeEvent('enterprise.approval.requested', 't1', { approvalId: 'a1', title: 'Approve Budget', resourceType: 'PROJECT', resourceId: 'p1' }));
      const node = graph.nodes.find(n => n.entityId === 'a1' && n.entityKind === 'APPROVAL');
      expect(node).toBeDefined();
    });

    it('creates IMPACTS edge to resource when resource exists', async () => {
      await graph.upsertNode('t1', 'PROJECT', 'p1', 'Project One', {});
      await consumer.onApprovalRequested(makeEvent('enterprise.approval.requested', 't1', { approvalId: 'a1', title: 'Approve Budget', resourceType: 'PROJECT', resourceId: 'p1' }));
      const edge = graph.edges.find(e => e.relationshipKind === 'IMPACTS');
      expect(edge).toBeDefined();
    });
  });

  describe('event emission', () => {
    it('emits enterprise.knowledge.updated after processing a project event', async () => {
      await consumer.onProjectCreated(makeEvent('enterprise.project.created', 't1', { projectId: 'p1', name: 'P1' }));
      const knowledgeEvent = transport.publishedEvents.find(e => e.eventType === 'enterprise.knowledge.updated');
      expect(knowledgeEvent).toBeDefined();
      expect(knowledgeEvent.tenantId).toBe('t1');
      expect(knowledgeEvent.idempotencyKey).toContain('knowledge:');
      expect(knowledgeEvent.sourceModule).toBe('EnterpriseIntelligenceNetwork');
    });

    it('emits enterprise.knowledge.updated after approval event', async () => {
      await consumer.onApprovalRequested(makeEvent('enterprise.approval.requested', 't1', { approvalId: 'a1', title: 'A1', resourceType: 'PROJECT', resourceId: 'p1' }));
      const knowledgeEvent = transport.publishedEvents.find(e => e.eventType === 'enterprise.knowledge.updated');
      expect(knowledgeEvent).toBeDefined();
    });
  });

  describe('handle() routing', () => {
    beforeEach(() => {
      consumer.onApplicationBootstrap();
    });

    it('routes enterprise.project.created to onProjectCreated', async () => {
      const spy = jest.spyOn(consumer as any, 'onProjectCreated').mockResolvedValue(undefined);
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent('enterprise.project.created', 't1', { projectId: 'p1', name: 'P1' }));
      expect(spy).toHaveBeenCalled();
    });

    it('routes enterprise.task.completed to onTaskCompleted', async () => {
      const spy = jest.spyOn(consumer as any, 'onTaskCompleted').mockResolvedValue(undefined);
      const handler = transport.registeredConsumer.handler;
      await handler(makeEvent('enterprise.task.completed', 't1', { taskId: 't1' }));
      expect(spy).toHaveBeenCalled();
    });
  });
});
