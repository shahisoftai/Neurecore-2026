/**
 * Enterprise Intelligence Network — engines (Phase 9).
 * KnowledgeGraph (CRUD, traversal, health), OntologyManager (versioned),
 * RelationshipEngine (Context Plane-driven inference), SemanticSearch,
 * KnowledgeReasoner, EnterpriseIntelligenceNetwork (orchestrator).
 * Graph stores relationships — NEVER owns operational state.
 */

import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { Prisma } from '@prisma/client';
import { CONTEXT_PLANE } from '../../context-plane/contracts/context-plane.interface';
import type { IOrganizationalContextPlane } from '../../context-plane/contracts/context-plane.interface';
import { ENTERPRISE_COGNITION } from '../../enterprise-cognition/contracts/enterprise-cognition.interface';
import type { IEnterpriseCognition } from '../../enterprise-cognition/contracts/enterprise-cognition.interface';
import type {
  EnterpriseDiscoveryFinding, GraphQueryResult, IOntologyManager, IEntityResolver, IRelationshipEngine, ISemanticSearch, IKnowledgeReasoner, IKnowledgeGraph, IEnterpriseIntelligenceNetwork, KnowledgeEdgeView, KnowledgeNodeView, KnowledgeHealth, OntologySchema, ReasoningAnswer, ResolvedEntity, SearchResult,
} from '../contracts/enterprise-intelligence.interface';

// ── Ontology (versioned) ────────────────────────────────────────────────────
@Injectable()
export class OntologyManager implements IOntologyManager {
  constructor(private readonly prisma: PrismaService) {}
  async currentVersion(tenantId: string): Promise<OntologySchema> {
    const row = await this.prisma.ontologyVersion.findFirst({ where: { tenantId }, orderBy: { version: 'desc' } });
    if (row) return (row.schemaJson as unknown) as OntologySchema;
    return {
      version: 1,
      entities: [
        { kind: 'PROJECT', label: 'Project', description: 'Enterprise project', properties: ['name','status','budget'] },
        { kind: 'CUSTOMER', label: 'Customer', description: 'Enterprise customer', properties: ['name','industry'] },
        { kind: 'MISSION', label: 'Mission', description: 'Autonomous mission', properties: ['title','status'] },
        { kind: 'EMPLOYEE', label: 'Employee', description: 'AI or human employee', properties: ['name','role'] },
        { kind: 'DEPARTMENT', label: 'Department', description: 'Organizational department', properties: ['name'] },
        { kind: 'RISK', label: 'Risk', description: 'Identified risk', properties: ['severity'] },
        { kind: 'APPROVAL', label: 'Approval', description: 'Pending/decided approval', properties: ['status'] },
        { kind: 'RECOMMENDATION', label: 'Recommendation', description: 'Cognitive recommendation', properties: ['priority'] },
      ],
      relationships: [
        { kind: 'DEPENDS_ON', label: 'depends on', sourceKinds: ['PROJECT','MISSION'], targetKinds: ['PROJECT','MISSION','APPROVAL'], bidirectional: false },
        { kind: 'PART_OF', label: 'part of', sourceKinds: ['EMPLOYEE','RISK','RECOMMENDATION'], targetKinds: ['DEPARTMENT','PROJECT','MISSION'], bidirectional: false },
        { kind: 'RELATED_TO', label: 'related to', sourceKinds: ['*'], targetKinds: ['*'], bidirectional: true },
        { kind: 'IMPACTS', label: 'impacts', sourceKinds: ['RISK','RECOMMENDATION'], targetKinds: ['PROJECT','MISSION'], bidirectional: false },
      ],
    };
  }
  async evolve(tenantId: string, schema: OntologySchema): Promise<void> {
    const latest = await this.currentVersion(tenantId);
    await this.prisma.ontologyVersion.create({
      data: { tenantId, version: latest.version + 1, schemaJson: schema as unknown as Prisma.InputJsonValue },
    });
  }
}

// ── Knowledge Graph (CRUD, traversal, health) ───────────────────────────────
@Injectable()
export class KnowledgeGraph implements IKnowledgeGraph {
  constructor(private readonly prisma: PrismaService) {}

  async upsertNode(tenantId: string, entityKind: string, entityId: string, label: string, metadata?: Record<string, unknown>): Promise<KnowledgeNodeView> {
    const row = await this.prisma.knowledgeNode.upsert({
      where: { tenantId_entityKind_entityId: { tenantId, entityKind: entityKind as any, entityId } },
      create: { tenantId, entityKind: entityKind as any, entityId, label, metadataJson: (metadata ?? {}) as Prisma.InputJsonValue } as Prisma.KnowledgeNodeUncheckedCreateInput,
      update: { label, metadataJson: (metadata ?? {}) as Prisma.InputJsonValue, updatedAt: new Date() } as Prisma.KnowledgeNodeUncheckedUpdateInput,
    });
    return { id: row.id, tenantId: row.tenantId, entityKind: row.entityKind, entityId: row.entityId, label: row.label, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }
  async upsertEdge(tenantId: string, sourceNodeId: string, targetNodeId: string, relationshipKind: string, evidence?: { source: string; reference: string; detail: string }[], confidence = 'MEDIUM'): Promise<KnowledgeEdgeView> {
    const row = await this.prisma.knowledgeEdge.upsert({
      where: { tenantId_sourceNodeId_targetNodeId_relationshipKind: { tenantId, sourceNodeId, targetNodeId, relationshipKind: relationshipKind as any } },
      create: { tenantId, sourceNodeId, targetNodeId, relationshipKind: relationshipKind as any, evidenceJson: (evidence ?? []) as Prisma.InputJsonValue, confidence },
      update: { evidenceJson: (evidence ?? []) as Prisma.InputJsonValue, confidence },
    });
    return { id: row.id, tenantId: row.tenantId, sourceNodeId: row.sourceNodeId, targetNodeId: row.targetNodeId, relationshipKind: row.relationshipKind, evidence: (row.evidenceJson ?? []) as any[], confidence: row.confidence as any, ontologyVersion: row.ontologyVersion, createdAt: row.createdAt.toISOString() };
  }
  async traverse(tenantId: string, nodeId: string, depth = 2): Promise<GraphQueryResult[]> {
    const seen = new Set<string>();
    const queue: { nodeId: string; d: number }[] = [{ nodeId, d: 0 }];
    const results: (KnowledgeNodeView & { outgoing: KnowledgeEdgeView[]; incoming: KnowledgeEdgeView[] })[] = [];
    while (queue.length > 0) {
      const { nodeId: nid, d } = queue.shift()!;
      if (seen.has(nid) || d > depth) continue;
      seen.add(nid);
      const node = await this.prisma.knowledgeNode.findFirst({ where: { id: nid, tenantId } });
      if (!node) continue;
      const [outgoing, incoming] = await Promise.all([
        this.prisma.knowledgeEdge.findMany({ where: { tenantId, sourceNodeId: nid } }),
        this.prisma.knowledgeEdge.findMany({ where: { tenantId, targetNodeId: nid } }),
      ]);
      const nodeView: KnowledgeNodeView = { id: node.id, tenantId: node.tenantId, entityKind: node.entityKind, entityId: node.entityId, label: node.label, createdAt: node.createdAt.toISOString(), updatedAt: node.updatedAt.toISOString() };
      const out = outgoing.map((e) => ({ id: e.id, tenantId: e.tenantId, sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId, relationshipKind: e.relationshipKind, evidence: (e.evidenceJson ?? []) as any[], confidence: e.confidence as any, ontologyVersion: e.ontologyVersion, createdAt: e.createdAt.toISOString() }));
      const inc = incoming.map((e) => ({ id: e.id, tenantId: e.tenantId, sourceNodeId: e.sourceNodeId, targetNodeId: e.targetNodeId, relationshipKind: e.relationshipKind, evidence: (e.evidenceJson ?? []) as any[], confidence: e.confidence as any, ontologyVersion: e.ontologyVersion, createdAt: e.createdAt.toISOString() }));
      results.push({ ...nodeView, outgoing: out, incoming: inc });
      if (d < depth) for (const e of outgoing) queue.push({ nodeId: e.targetNodeId, d: d + 1 });
    }
    return results.map((r) => ({ node: { id: r.id, tenantId: r.tenantId, entityKind: r.entityKind, entityId: r.entityId, label: r.label, createdAt: r.createdAt, updatedAt: r.updatedAt }, outgoingEdges: r.outgoing, incomingEdges: r.incoming }));
  }
  async findNode(tenantId: string, entityKind: string, entityId: string): Promise<KnowledgeNodeView | null> {
    const row = await this.prisma.knowledgeNode.findUnique({ where: { tenantId_entityKind_entityId: { tenantId, entityKind: entityKind as any, entityId } } });
    if (!row) return null;
    return { id: row.id, tenantId: row.tenantId, entityKind: row.entityKind, entityId: row.entityId, label: row.label, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
  }
  async searchNodes(tenantId: string, query: string, limit = 20): Promise<KnowledgeNodeView[]> {
    const rows = await this.prisma.knowledgeNode.findMany({ where: { tenantId, label: { contains: query, mode: 'insensitive' } }, take: limit });
    return rows.map((r) => ({ id: r.id, tenantId: r.tenantId, entityKind: r.entityKind, entityId: r.entityId, label: r.label, createdAt: r.createdAt.toISOString(), updatedAt: r.updatedAt.toISOString() }));
  }
  async health(tenantId: string): Promise<KnowledgeHealth> {
    const [nodeCount, edgeCount, orphanCount, versionCount] = await Promise.all([
      this.prisma.knowledgeNode.count({ where: { tenantId } }),
      this.prisma.knowledgeEdge.count({ where: { tenantId } }),
      this.prisma.$queryRawUnsafe<{ count: bigint }[]>(`SELECT COUNT(*) as count FROM knowledge_nodes n LEFT JOIN knowledge_edges e1 ON n.id = e1."sourceNodeId" LEFT JOIN knowledge_edges e2 ON n.id = e2."targetNodeId" WHERE n."tenantId" = '${tenantId}' AND e1.id IS NULL AND e2.id IS NULL`,).catch(() => [{ count: 0n }]),
      this.prisma.ontologyVersion.count({ where: { tenantId } }),
    ]);
    const orphaned = Number(orphanCount?.[0]?.count ?? 0);
    return { nodeCount, edgeCount, orphanNodes: orphaned, ontologyVersions: versionCount, consistencyGrade: orphaned === 0 ? 'EXCELLENT' : 'GOOD' };
  }
}

// ── Entity Resolver (dedup within graph) ─────────────────────────────────────
@Injectable()
export class EntityResolver implements IEntityResolver {
  constructor(private readonly graph: KnowledgeGraph) {}
  async resolve(tenantId: string, entityKind: string, entityId: string): Promise<ResolvedEntity> {
    const node = await this.graph.findNode(tenantId, entityKind, entityId);
    if (!node) return { canonicalId: entityId, aliases: [], confidence: 'LOW', entityKind };
    return { canonicalId: node.id, aliases: [entityId], confidence: 'HIGH', entityKind: node.entityKind };
  }
}

// ── Relationship Engine (Context Plane-driven inference) ────────────────────
@Injectable()
export class RelationshipEngine implements IRelationshipEngine {
  private readonly logger = new Logger(RelationshipEngine.name);
  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly graph: KnowledgeGraph,
  ) {}
  async infer(tenantId: string): Promise<KnowledgeEdgeView[]> {
    const ctx = await this.plane.assemble({ tenantId, actorId: 'system', actorType: 'AI_AGENT', scope: {} }).catch(() => null);
    if (!ctx) return [];
    const edges: KnowledgeEdgeView[] = [];
    const caps = ctx.capabilities ?? {};
    // Projects → Customer (PART_OF customer ecosystem)
    const projects = (caps.projects as any)?.data;
    if (projects && Array.isArray(projects.projects)) {
      for (const p of projects.projects as any[]) {
        const pNode = await this.graph.upsertNode(tenantId, 'PROJECT', p.id, p.name ?? p.id, { status: p.status, budget: p.budgetAmount });
        if (p.customerId) {
          const cNode = await this.graph.upsertNode(tenantId, 'CUSTOMER', p.customerId, `Customer ${p.customerId}`);
          edges.push(await this.graph.upsertEdge(tenantId, pNode.id, cNode.id, 'RELATED_TO', [{ source: 'CONTEXT_PLANE', reference: 'projects', detail: `Project ${p.name} linked to customer ${p.customerId}` }]));
        }
      }
    }
    return edges;
  }
}

// ── Semantic Search ─────────────────────────────────────────────────────────
@Injectable()
export class SemanticSearch implements ISemanticSearch {
  constructor(private readonly graph: KnowledgeGraph, private readonly prisma: PrismaService) {}
  async search(tenantId: string, query: string, limit = 20): Promise<SearchResult[]> {
    const out: SearchResult[] = [];
    const nodes = await this.graph.searchNodes(tenantId, query, limit);
    for (const n of nodes) out.push({ entityKind: n.entityKind, entityId: n.entityId, label: n.label, score: 1.0, source: 'GRAPH' });
    // Also search project memory
    const memRows = await this.prisma.projectMemory.findMany({ where: { content: { contains: query, mode: 'insensitive' } }, take: Math.min(limit, 10), select: { id: true, projectId: true, content: true, category: true } }).catch(() => []);
    for (const r of memRows) out.push({ entityKind: 'PROJECT_MEMORY', entityId: r.id, label: r.content.slice(0, 100), score: 0.8, source: 'MEMORY' });
    return out.slice(0, limit);
  }
}

// ── Knowledge Reasoner ──────────────────────────────────────────────────────
@Injectable()
export class KnowledgeReasoner implements IKnowledgeReasoner {
  constructor(
    private readonly graph: KnowledgeGraph,
    @Inject(ENTERPRISE_COGNITION) private readonly cognition: IEnterpriseCognition,
  ) {}
  async reason(tenantId: string, question: string, _context?: Record<string, unknown>): Promise<ReasoningAnswer> {
    // Query the graph for relevant nodes, then use Cognition to synthesize.
    const nodes = await this.graph.searchNodes(tenantId, question.split(' ').find((w) => w.length > 3) ?? question, 5);
    const evidence = nodes.map((n) => ({ source: 'GRAPH', detail: `${n.entityKind}: ${n.label}` }));
    const cog = await this.cognition.cognize({ tenantId, actorId: 'system', actorType: 'AI_AGENT', request: `Knowledge reasoning: ${question}. Known entities: ${evidence.map((e) => e.detail).join('; ')}. Answer concisely with evidence.` }).catch(() => null);
    return {
      question,
      answer: cog?.recommendations?.[0]?.title ?? cog?.objective?.reasoning?.conclusion ?? 'Unable to derive answer from current knowledge graph.',
      evidence,
      confidence: evidence.length > 0 ? 'MEDIUM' : 'LOW',
    };
  }
}

// ── Orchestrator ────────────────────────────────────────────────────────────
@Injectable()
export class EnterpriseIntelligenceNetwork implements IEnterpriseIntelligenceNetwork {
  constructor(
    private readonly kg: KnowledgeGraph,
    private readonly searchEng: SemanticSearch,
    private readonly reasoner: KnowledgeReasoner,
    private readonly relationship: RelationshipEngine,
  ) {}
  graph = () => this.kg;
  search = (t: string, q: string) => this.searchEng.search(t, q);
  reason = (t: string, q: string) => this.reasoner.reason(t, q);
  discover = async (tenantId: string): Promise<EnterpriseDiscoveryFinding[]> => {
    const h = await this.kg.health(tenantId);
    const findings: EnterpriseDiscoveryFinding[] = [];
    if (h.orphanNodes > 0) findings.push({ kind: 'KNOWLEDGE_GAP', detail: `${h.orphanNodes} orphan node(s) — no relationships`, severity: 'MEDIUM', recommendation: 'Run relationship inference to connect isolated entities.' });
    return findings;
  };
  health = (t: string) => this.kg.health(t);
  refresh = (t: string, _a: string) => this.relationship.infer(t);
}
