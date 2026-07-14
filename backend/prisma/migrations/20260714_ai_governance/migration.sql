CREATE TYPE "TrustGrade" AS ENUM ('EXCELLENT','GOOD','FAIR','POOR','CRITICAL');
CREATE TYPE "AIPolicyCategory" AS ENUM ('MODEL_USAGE','PROMPT','REASONING','EVIDENCE','CONFIDENCE','HUMAN_REVIEW','APPROVAL','RISK','ETHICS');
CREATE TYPE "CertificationStatus" AS ENUM ('CERTIFIED','CONDITIONAL','REQUIRES_REVIEW','REJECTED','EXPIRED','REVOKED');
CREATE TYPE "ReviewDecision" AS ENUM ('APPROVED','REJECTED','NEEDS_REVISION','ESCALATED');

CREATE TABLE "trust_evaluations" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "trustScore" "TrustGrade" NOT NULL DEFAULT 'GOOD', "evidenceQuality" "TrustGrade" NOT NULL DEFAULT 'GOOD', "reasoningQuality" "TrustGrade" NOT NULL DEFAULT 'GOOD', "riskLevel" "TrustGrade" NOT NULL DEFAULT 'GOOD', "policyCompliant" BOOLEAN NOT NULL DEFAULT true, "issues" TEXT[] DEFAULT ARRAY[]::TEXT[], "evidenceJson" JSONB NOT NULL DEFAULT '{}', "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE INDEX ON "trust_evaluations"("tenantId","sourceType","createdAt");

CREATE TABLE "ai_hallucination_flags" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "claim" TEXT NOT NULL, "evidenceGap" TEXT NOT NULL, "severity" "TrustGrade" NOT NULL DEFAULT 'FAIR', "recommendedAction" TEXT, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE INDEX ON "ai_hallucination_flags"("tenantId","sourceType");

CREATE TABLE "ai_bias_findings" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "category" TEXT NOT NULL, "detail" TEXT NOT NULL, "severity" "TrustGrade" NOT NULL DEFAULT 'FAIR', "recommendation" TEXT, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE INDEX ON "ai_bias_findings"("tenantId","category");

CREATE TABLE "ai_policies" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "name" TEXT NOT NULL, "category" "AIPolicyCategory" NOT NULL, "version" INT NOT NULL DEFAULT 1, "rulesJson" JSONB NOT NULL DEFAULT '{}', "active" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX ON "ai_policies"("tenantId","name","version");

CREATE TABLE "ai_model_registry" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "modelName" TEXT NOT NULL, "provider" TEXT NOT NULL, "capabilities" TEXT[] DEFAULT ARRAY[]::TEXT[], "limitations" TEXT[] DEFAULT ARRAY[]::TEXT[], "status" TEXT NOT NULL DEFAULT 'REGISTERED', "evaluatedAt" TIMESTAMP, "retiredAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE UNIQUE INDEX ON "ai_model_registry"("tenantId","modelName");

CREATE TABLE "ai_human_reviews" ("id" TEXT PRIMARY KEY, "tenantId" TEXT NOT NULL, "sourceType" TEXT NOT NULL, "sourceId" TEXT NOT NULL, "reviewerId" TEXT, "decision" "ReviewDecision" NOT NULL DEFAULT 'NEEDS_REVISION', "reason" TEXT, "reviewedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT NOW());
CREATE INDEX ON "ai_human_reviews"("tenantId","sourceType");

-- DOWN: DROP all 6 tables; DROP 4 types
