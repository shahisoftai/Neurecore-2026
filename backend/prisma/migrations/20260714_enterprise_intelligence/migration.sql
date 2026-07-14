-- Enterprise Intelligence Network (Phase 9) — Knowledge Graph
-- Purely additive: 3 enums + 3 tables + indexes + 2 FKs. Reversible.

CREATE TYPE "OntologyEntityKind" AS ENUM ('EMPLOYEE','DEPARTMENT','PROJECT','CUSTOMER','SUPPLIER','PRODUCT','MISSION','WORK_RUN','RECOMMENDATION','STRATEGY','RISK','APPROVAL','GOVERNANCE_RULE','DOCUMENT','POLICY','EVENT','CAPABILITY','KNOWLEDGE_CLUSTER','CUSTOM');
CREATE TYPE "RelationshipKind" AS ENUM ('DEPENDS_ON','OWNS','REPORTS_TO','INFLUENCES','IMPACTS','RELATED_TO','PRECEDES','CONFLICTS_WITH','SUPPORTS','DELEGATES_TO','RESOLVES','CREATED_BY','APPROVED_BY','PART_OF','CUSTOM');

CREATE TABLE "ontology_versions" ("id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "version" INT NOT NULL, "schemaJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX ON "ontology_versions"("tenantId","version");

CREATE TABLE "knowledge_nodes" ("id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "entityKind" "OntologyEntityKind" NOT NULL, "entityId" TEXT NOT NULL, "label" TEXT NOT NULL, "metadataJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(), "updatedAt" TIMESTAMP NOT NULL);
CREATE UNIQUE INDEX ON "knowledge_nodes"("tenantId","entityKind","entityId");
CREATE INDEX ON "knowledge_nodes"("tenantId","entityKind");
CREATE INDEX ON "knowledge_nodes"("tenantId","label");

CREATE TABLE "knowledge_edges" ("id" TEXT NOT NULL PRIMARY KEY, "tenantId" TEXT NOT NULL, "sourceNodeId" TEXT NOT NULL REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE, "targetNodeId" TEXT NOT NULL REFERENCES "knowledge_nodes"("id") ON DELETE CASCADE, "relationshipKind" "RelationshipKind" NOT NULL, "evidenceJson" JSONB NOT NULL DEFAULT '[]', "confidence" TEXT NOT NULL DEFAULT 'MEDIUM', "ontologyVersion" INT NOT NULL DEFAULT 1, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX ON "knowledge_edges"("tenantId","sourceNodeId","targetNodeId","relationshipKind");
CREATE INDEX ON "knowledge_edges"("tenantId","sourceNodeId");
CREATE INDEX ON "knowledge_edges"("tenantId","targetNodeId");

-- DOWN: DROP TABLE "knowledge_edges"; DROP TABLE "knowledge_nodes"; DROP TABLE "ontology_versions"; DROP TYPE "RelationshipKind"; DROP TYPE "OntologyEntityKind";
