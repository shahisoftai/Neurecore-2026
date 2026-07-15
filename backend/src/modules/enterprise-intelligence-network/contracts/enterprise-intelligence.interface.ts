/**
 * Enterprise Intelligence Network — contracts (Phase 9).
 * Knowledge Graph (relationships, never owns operational state), Ontology
 * (versioned), Entity Resolution, Relationship Engine, Semantic Search,
 * Knowledge Reasoning, Knowledge Governance, Graph API.
 * Read-only intelligence layer — never executes, never mutates capabilities.
 */

export type Grade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR' | 'CRITICAL';
export type Confidence = 'VERY_LOW' | 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

// ── Ontology ────────────────────────────────────────────────────────────────
export interface OntologySchema {
  version: number;
  entities: { kind: string; label: string; description: string; properties: string[] }[];
  relationships: { kind: string; label: string; sourceKinds: string[]; targetKinds: string[]; bidirectional: boolean }[];
}

// ── Knowledge Graph ─────────────────────────────────────────────────────────
export interface KnowledgeNodeView {
  id: string; tenantId: string; entityKind: string; entityId: string; label: string;
  createdAt: string; updatedAt: string;
}
export interface KnowledgeEdgeView {
  id: string; tenantId: string; sourceNodeId: string; targetNodeId: string;
  relationshipKind: string; evidence: { source: string; reference: string; detail: string }[];
  confidence: Confidence; ontologyVersion: number; createdAt: string;
}
export interface GraphQueryResult { node: KnowledgeNodeView; outgoingEdges: KnowledgeEdgeView[]; incomingEdges: KnowledgeEdgeView[] }

// ── Entity Resolution ───────────────────────────────────────────────────────
export interface ResolvedEntity { canonicalId: string; aliases: string[]; confidence: Confidence; entityKind: string }

// ── Semantic Search ─────────────────────────────────────────────────────────
export interface SearchResult { entityKind: string; entityId: string; label: string; score: number; source: 'GRAPH' | 'MEMORY' | 'RUNTIME' | 'AUDIT' }

// ── Knowledge Reasoning ─────────────────────────────────────────────────────
export interface ReasoningAnswer { question: string; answer: string; evidence: { source: string; detail: string }[]; confidence: Confidence }

// ── Knowledge Governance ────────────────────────────────────────────────────
export interface KnowledgeHealth { nodeCount: number; edgeCount: number; orphanNodes: number; ontologyVersions: number; consistencyGrade: Grade }

// ── Discovery ───────────────────────────────────────────────────────────────
export interface EnterpriseDiscoveryFinding { kind: 'KNOWLEDGE_CLUSTER' | 'ORGANIZATIONAL_SILO' | 'DUPLICATED_WORK' | 'EXPERTISE_CONCENTRATION' | 'KNOWLEDGE_GAP' | 'MISSION_OVERLAP' | 'RISK_PROPAGATION'; detail: string; severity: 'INFO' | 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'; recommendation: string | null }

// ── Ports ───────────────────────────────────────────────────────────────────
export const KNOWLEDGE_GRAPH = Symbol('KNOWLEDGE_GRAPH');
export interface IKnowledgeGraph {
  upsertNode(tenantId: string, entityKind: string, entityId: string, label: string, metadata?: Record<string, unknown>): Promise<KnowledgeNodeView>;
  upsertEdge(tenantId: string, sourceNodeId: string, targetNodeId: string, relationshipKind: string, evidence?: { source: string; reference: string; detail: string }[], confidence?: Confidence): Promise<KnowledgeEdgeView>;
  traverse(tenantId: string, nodeId: string, depth?: number): Promise<GraphQueryResult[]>;
  findNode(tenantId: string, entityKind: string, entityId: string): Promise<KnowledgeNodeView | null>;
  searchNodes(tenantId: string, query: string, limit?: number): Promise<KnowledgeNodeView[]>;
  health(tenantId: string): Promise<KnowledgeHealth>;
}

export const ONTOLOGY_MANAGER = Symbol('ONTOLOGY_MANAGER');
export interface IOntologyManager {
  currentVersion(tenantId: string): Promise<OntologySchema>;
  evolve(tenantId: string, schema: OntologySchema): Promise<void>;
}

export const ENTITY_RESOLVER = Symbol('ENTITY_RESOLVER');
export interface IEntityResolver {
  resolve(tenantId: string, entityKind: string, entityId: string): Promise<ResolvedEntity>;
}

export const RELATIONSHIP_ENGINE = Symbol('RELATIONSHIP_ENGINE');
export interface IRelationshipEngine {
  /**
   * Inferred an actorId so the audit trail distinguishes the operator
   * who triggered the inference from a hard-coded 'system' string
   * (audit-remediation).
   */
  infer(tenantId: string, actorId: string): Promise<KnowledgeEdgeView[]>;
}

export const SEMANTIC_SEARCH = Symbol('SEMANTIC_SEARCH');
export interface ISemanticSearch {
  search(tenantId: string, query: string, limit?: number): Promise<SearchResult[]>;
}

export const KNOWLEDGE_REASONER = Symbol('KNOWLEDGE_REASONER');
export interface IKnowledgeReasoner {
  reason(tenantId: string, question: string, context?: Record<string, unknown>): Promise<ReasoningAnswer>;
}

export const ENTERPRISE_INTELLIGENCE = Symbol('ENTERPRISE_INTELLIGENCE');
export interface IEnterpriseIntelligenceNetwork {
  graph(): IKnowledgeGraph;
  search(tenantId: string, query: string): Promise<SearchResult[]>;
  reason(tenantId: string, question: string): Promise<ReasoningAnswer>;
  discover(tenantId: string): Promise<EnterpriseDiscoveryFinding[]>;
  health(tenantId: string): Promise<KnowledgeHealth>;
  refresh(tenantId: string, actorId: string): Promise<KnowledgeEdgeView[]>;
}
