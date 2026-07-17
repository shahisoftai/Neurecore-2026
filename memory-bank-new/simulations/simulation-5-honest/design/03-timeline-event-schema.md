# Item 3: TimelineEvent, IdempotencyRecord, ServiceIdentity, ServiceToken, DecisionEvaluation Schemas

This document is the exact Prisma schema for the new tables. The new fields on existing tables (listed in `02-entity-mapping-audit.md`) are not repeated here; this file is only the new tables.

## Migration name

`20260717_simulation_5_honest_timeline_and_idempotency`

## 1. TimelineEvent

```prisma
model TimelineEvent {
  id                String                  @id @default(cuid())
  tenantId          String
  tenant            Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // The project this event is primarily associated with (optional but recommended)
  projectId         String?
  project           Project?                @relation(fields: [projectId], references: [id], onDelete: SetNull)

  // The simulation run this event belongs to (null in production).
  // simulationId is a globally unique URI of the form
  //   sim://<year>/<month>/<day>/<org-slug>/<framework>/<seq>
  // (see 04-simulation-tagging-rules.md §1).
  // We do NOT create a SimulationRun table now; the field is a free
  // string. When SimulationRun is later added, this becomes a
  // foreign key via a one-line migration.
  simulationId      String?
  simulationRunId   String?                 // forward-compatible database-row id

  // When the event happened in the world (vs when we recorded it)
  occurredAt        DateTime
  recordedAt        DateTime                @default(now())

  // Classification
  category          TimelineCategory
  severity          EventSeverity
  sourceType        TimelineSourceType
  sourceId          String?                 // optional reference to actor (userId, agentId, integrationId, serviceIdentityId, etc.)

  // Human-readable
  title             String
  description       String                  @db.Text

  // Cross-entity linking. The "decision/task/approval" link lets us
  // traverse: TimelineEvent → Decision → Tasks → Approvals → Events.
  // Indexes below support graph queries.
  relatedEntityType String?
  relatedEntityId   String?

  // Distributed tracing
  correlationId     String?
  traceId           String?
  causationId       String?

  // Cascade graph
  parentEventId     String?
  parentEvent       TimelineEvent?          @relation("TimelineCascade", fields: [parentEventId], references: [id], onDelete: SetNull)
  rootEventId       String?
  childEvents       TimelineEvent[]         @relation("TimelineCascade")

  // Lifecycle. See §1.1 below for the meaning of each value.
  status            TimelineEventStatus     @default(REPORTED)
  invalidatedAt     DateTime?
  invalidatedBy     String?                 // userId, agentId, or serviceIdentityId
  invalidationReason String?                @db.Text
  cancelledAt       DateTime?
  cancelledBy       String?
  cancellationReason String?                @db.Text

  // Who created the record (in NeuroCore's audit sense).
  // Exactly one of these is set: a human user, an agent, or a service identity.
  createdByUserId            String?
  createdByAgentId           String?
  createdByServiceIdentityId String?

  // Free-form engine-specific extras
  metadata          Json?                   @default("{}")

  // Server-managed timestamps
  createdAt         DateTime                @default(now())
  updatedAt         DateTime                @updatedAt

  @@index([tenantId, occurredAt])
  @@index([tenantId, projectId])
  @@index([tenantId, simulationId])
  @@index([tenantId, status])
  @@index([tenantId, category, occurredAt])
  @@index([correlationId])
  @@index([rootEventId])
  @@index([parentEventId])
  @@index([relatedEntityType, relatedEntityId])
  @@map("timeline_events")
}

enum TimelineCategory {
  OPERATIONAL
  SUPPLY_CHAIN
  SECURITY
  COMPLIANCE
  FINANCIAL
  STAKEHOLDER
  HR
  WEATHER
  EXTERNAL
  AI_ACTION
  SIMULATION
  CUSTOM
}

enum TimelineSourceType {
  HUMAN
  AI
  INTEGRATION
  SERVICE_IDENTITY
  SIMULATION_CONTROLLER
}

enum TimelineEventStatus {
  DRAFT          // two-phase creation in progress; not exposed in operational views
  REPORTED       // newly created, not yet verified
  VERIFIED       // confirmed by the engine; not yet active
  ACTIVE         // in effect, not yet resolved
  RESOLVED       // finished, with or without action taken
  INVALIDATED    // rolled back because the event was found to be incorrect
  CANCELLED      // rolled back by an explicit user or system action before it took effect
  FAILED         // two-phase creation failed; chain not exposed in operational views
}

enum EventSeverity {
  LOW
  MEDIUM
  HIGH
  CRITICAL
}
```

### 1.1 Lifecycle semantics (revised)

| State | Meaning | How reached |
|---|---|---|
| `DRAFT` | Two-phase cascade creation in progress. Not visible in operational views. | Initial state for cascade child events. |
| `REPORTED` | Newly created, not yet verified. | Default state for top-level events. |
| `VERIFIED` | Confirmed by the engine; not yet active. | After two-phase cascade validation. |
| `ACTIVE` | In effect, not yet resolved. | After VERIFIED, when the event has downstream consequences. |
| `RESOLVED` | Finished, with or without action taken. | Manual or automatic resolution. |
| `INVALIDATED` | Rolled back because the event was found to be incorrect (e.g. the report was wrong). | Operator action. |
| `CANCELLED` | Rolled back by an explicit user or system action before it took effect. | Operator action. |
| `FAILED` | Two-phase creation failed. The event never existed in operational views. | Validation failure during cascade creation. |

**`INVALIDATED` vs `CANCELLED`**: both roll the event back, but for different reasons. `INVALIDATED` is "this should never have happened" (the data was wrong). `CANCELLED` is "this would have happened but we decided not to" (an explicit rollback). The `invalidatedBy`/`cancelledBy` fields capture who made the call, and the reason fields capture why.

### 1.2 Traversal

`relatedEntityType` + `relatedEntityId` lets a graph query traverse:

```
TimelineEvent (cause)
  → relatedEntityType='ProjectDecision' → ProjectDecision
    → relatedEntityType='Task' → Task
      → relatedEntityType='ApprovalRequest' → ApprovalRequest
    → linkedEntityType='Routine' → Routine
  → relatedEntityType='ProjectDecision' (outcome event)
    → ProjectDecision (the realized outcome)
```

The framework's audit and scoring services traverse this graph to compute the timing metrics, the prediction-accuracy metric, and the cascade detection metric.

## 2. SimulationRun (forward-compatible — DO NOT CREATE YET)

We do **not** create this table now. The simulation run is represented as a tagged `Project`. If we later create `SimulationRun`, its minimal schema is reserved here so the team can implement it without re-deriving the shape:

```prisma
// RESERVED — DO NOT CREATE YET
model SimulationRun {
  id                String          @id @default(cuid())
  tenantId          String
  tenant            Tenant          @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  projectId         String          @unique
  project           Project         @relation(fields: [projectId], references: [id], onDelete: Cascade)
  simulationId      String          @unique                  // the URI
  seed              String
  rng               Json            // { algorithm, version }
  framework         Json            // { name, version }
  engines           Json            // engine-name → version map
  schemaVersion     String
  scoringVersion    String
  llm               Json            // { provider, providerVersion, model, modelVersion, structuredOutputMode }
  engineConfig      Json
  status            SimulationStatus @default(PENDING)
  currentDay        Int             @default(0)
  startedAt         DateTime?
  completedAt       DateTime?
  metadata          Json            @default("{}")
  createdAt         DateTime        @default(now())
  updatedAt         DateTime        @updatedAt

  timelineEvents    TimelineEvent[]

  @@index([tenantId])
  @@map("simulation_runs")
}

enum SimulationStatus {
  PENDING
  RUNNING
  PAUSED
  COMPLETED
  ABORTED
}
```

The vertical slice implementation **will not** add this. The `simulationId` field on `TimelineEvent` and other entities is treated as an opaque string. The `simulationRunId` is set to the simulation Project's `id`. When we later add `SimulationRun`, a one-line migration adds the unique constraint and the existing `simulationId` strings map cleanly to the new rows.

## 3. ServiceIdentity and ServiceToken (new in revision 1)

We do **not** mix service identities with `User`. A `ServiceIdentity` is its own first-class concept.

```prisma
model ServiceIdentity {
  id                String                  @id @default(cuid())
  tenantId          String
  tenant            Tenant                  @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // Human-meaningful name. Example: "simulation-5-engine-001".
  name              String

  // Description shown in admin UI
  description       String?                 @db.Text

  // The scopes this identity is allowed to use. Enforced at every
  // request. Examples: ['simulation-engine', 'webhook-dispatcher',
  // 'integration:hubspot', 'scheduled-job:nightly-reconcile'].
  scopes            String[]

  // Enabled means the identity can still issue tokens. Revoked identities
  // cannot issue new tokens; existing tokens expire normally.
  enabled           Boolean                 @default(true)
  revokedAt         DateTime?
  revokedBy         String?                 // userId

  // Audit
  createdByUserId   String
  createdBy         User                    @relation("ServiceIdentityCreator", fields: [createdByUserId], references: [id])
  createdAt         DateTime                @default(now())
  lastUsedAt        DateTime?

  tokens            ServiceToken[]

  @@unique([tenantId, name])
  @@index([tenantId])
  @@map("service_identities")
}

model ServiceToken {
  id                  String              @id @default(cuid())
  serviceIdentityId   String
  serviceIdentity     ServiceIdentity     @relation(fields: [serviceIdentityId], references: [id], onDelete: Cascade)
  tenantId            String

  // The scopes this token is allowed to use. Snapshotted at issue time
  // so revoking a scope on the parent does not retroactively invalidate
  // already-issued tokens until they expire.
  scopes              String[]

  // Hash of the issued token. The plaintext token is returned ONCE at
  // issue and never stored. All later verification is by hash.
  tokenHash           String              @unique

  // Lifecycle
  issuedAt            DateTime            @default(now())
  expiresAt           DateTime            // short-lived (1h default)
  revokedAt           DateTime?
  lastUsedAt          DateTime?

  @@index([tenantId, expiresAt])
  @@index([serviceIdentityId])
  @@map("service_tokens")
}
```

### 3.1 Why a separate table

- A `User` is a person. A `ServiceIdentity` is a workload (a simulation engine, a webhook dispatcher, a scheduled job, an external integration, a CLI). Mixing them creates long-term security ambiguity.
- `User` is queried for "who is this person, what org are they in, what is their role". `ServiceIdentity` is queried for "what scopes does this workload hold, who created it, when did it last act".
- A future `AuditInterceptor` (already in use in NeuroCore) writes `actorType: 'USER'` for users and `actorType: 'SERVICE_IDENTITY'` for service identities. The two paths are auditable in the same `ActivityEvent` table but distinguishable in the `actorType` field.
- The `TimelineEvent.sourceType` enum was updated to replace `SYSTEM` with `SERVICE_IDENTITY`. The `TimelineEvent.createdBy*Id` fields were updated: now exactly one of `createdByUserId`, `createdByAgentId`, `createdByServiceIdentityId` is set.

### 3.2 Service token flow

1. An `ADMIN` (or higher) user calls `POST /api/v1/service-identities` with `{ name, description, scopes: ['simulation-engine'] }`. The framework creates the `ServiceIdentity` row.
2. The same user calls `POST /api/v1/service-identities/:id/tokens` with `{ ttlSeconds: 3600 }`. The framework creates a `ServiceToken` row, returns the plaintext token **once** with `expiresAt`, and stores only the `tokenHash`.
3. The simulation framework stores the token in a secure in-memory store and uses it to call backend APIs. The token is never logged, never returned to a UI, and never persisted in plaintext.
4. Every call the framework makes includes `Authorization: Bearer <token>`. A new `ServiceIdentityGuard` verifies the token: hash match, not revoked, not expired, requested scope is in `scopes`.
5. The simulation framework never uses a `User` token for engine calls. The `RolesGuard` is not used in service-identity paths; the `ServiceIdentityGuard` is.

## 4. DecisionEvaluation (new in revision 2)

We store decision scores in a separate `DecisionEvaluation` table rather than as a mutable JSON column on `ProjectDecision`. A decision is immutable; evaluations are not.

```prisma
model DecisionEvaluation {
  id                String                    @id @default(cuid())
  tenantId          String
  tenant            Tenant                    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  decisionId        String
  decision          ProjectDecision           @relation(fields: [decisionId], references: [id], onDelete: Cascade)
  simulationId      String?

  evaluationKind    DecisionEvaluationKind    // INITIAL, MIDTERM, FINAL, RETROSPECTIVE
  scoringVersion    String                    // e.g. "v1"

  // The actual scores snapshot. This is a JSON object matching the
  // ScoringOutput shape defined in scoring/scoring-v1.ts. Snapshotted
  // here so a future scoring version does not retroactively rewrite
  // historical evaluations.
  scores            Json

  // Who produced the evaluation. SYSTEM = scoring service (a service
  // identity with scope 'simulation-engine' or 'scoring-service').
  // HUMAN = a human reviewer. AGENT = an agent-runtime call that
  // produced a qualitative review (this is allowed; see
  // 08-vertical-slice-spec.md §5 for the LLM-as-qualitative-reviewer
  // pattern).
  evaluatorKind     EvaluatorKind
  evaluatorId       String?                   // userId, agentId, or serviceIdentityId

  evaluatedAt       DateTime                  @default(now())
  notes             String?                   @db.Text
  metadata          Json                      @default("{}")

  @@index([decisionId, evaluatedAt])
  @@index([tenantId, simulationId])
  @@index([scoringVersion])
  @@map("decision_evaluations")
}

enum DecisionEvaluationKind {
  INITIAL            // produced when the decision is finalized
  MIDTERM            // produced mid-execution
  FINAL              // produced at execution close
  RETROSPECTIVE      // produced after a longer delay
}

enum EvaluatorKind {
  SYSTEM             // a service identity (scoring service, simulation engine)
  HUMAN              // a human user
  AGENT              // an agent-runtime call (qualitative review only)
}
```

### 4.1 ProjectDecision changes

- The `qualityScores Json?` field is **dropped** from `ProjectDecision`.
- A new `latestEvaluationId String?` field is added for fast lookup. The `ProjectDecision` row itself remains immutable after `status='APPROVED'`; the `latestEvaluationId` is updated whenever a new `DecisionEvaluation` is created and is the "current" one. (We could also store it on the `ProjectDecision` row without violating immutability because the row's own evaluation is updated, not its decision content. The decision content — `title`, `description`, `category`, `expectedOutcome`, `confidenceEstimate`, `evidenceRefs` — remains immutable once `status='APPROVED'`.)

## 5. IdempotencyRecord (revised in revision 5)

```prisma
model IdempotencyRecord {
  id                String                @id @default(cuid())
  tenantId          String
  tenant            Tenant                @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  // The client-supplied key. Format: see 07-idempotency-strategy.md
  key               String

  // The endpoint and a hash of the request body, used to detect "same key, different request" cases
  requestPath       String
  requestHash       String                // SHA-256 of canonicalized request body, hex

  // Lifecycle fields (revised)
  status            IdempotencyStatus     @default(IN_FLIGHT)
  startedAt         DateTime              @default(now())
  completedAt       DateTime?
  attemptCount      Int                   @default(1)
  lastErrorCode     String?
  lastErrorMessage  String?               @db.Text

  // Response snapshot
  responseStatus    Int?
  responseChecksum  String?               // SHA-256 of canonicalized response body
  responseBody      Json?
  resultEntityType  String?
  resultEntityId    String?

  expiresAt         DateTime
  createdAt         DateTime              @default(now())
  updatedAt         DateTime              @updatedAt

  @@unique([tenantId, key])
  @@index([tenantId, expiresAt])
  @@index([status])
  @@map("idempotency_records")
}

enum IdempotencyStatus {
  IN_FLIGHT
  COMPLETED
  FAILED
}
```

### 5.1 What the new fields add

- `startedAt` / `completedAt` make the lifecycle explicit. Useful for debugging "why did this take 30 seconds" and for the sweeper that finds `IN_FLIGHT` records that are stuck.
- `attemptCount` increments on each retry. A client retrying 5 times produces an `attemptCount=5` record. Useful for "this client keeps retrying, is something wrong?"
- `responseChecksum` is the SHA-256 of the canonicalized response body. On a replay the server compares the response body's checksum to this value to verify the body has not been corrupted in storage. A mismatch triggers 500 `RESPONSE_CORRUPTED` and the operator is alerted.
- `lastErrorCode` and `lastErrorMessage` are populated when the original attempt failed (`status='FAILED'`). Useful for "I retried with the same key, why is it still failing?".

## 6. New fields on existing tables (summary, updated)

These are referenced in `02-entity-mapping-audit.md`. They are listed again here as a migration checklist for the implementer. **The `qualityScores` field is dropped from this list; it is replaced by the `DecisionEvaluation` table above.**

| Table | Field | Type | Default | Index |
|---|---|---|---|---|
| `ProjectDecision` | `simulationId` | `String?` | NULL | yes |
| `ProjectDecision` | `expectedOutcome` | `String? @db.Text` | NULL | no |
| `ProjectDecision` | `actualOutcome` | `String? @db.Text` | NULL | no |
| `ProjectDecision` | `confidenceEstimate` | `Int?` | NULL | no |
| `ProjectDecision` | `counterfactualBest` | `String? @db.Text` | NULL | no |
| `ProjectDecision` | `lessonsLearned` | `String? @db.Text` | NULL | no |
| `ProjectDecision` | `evidenceRefs` | `Json?` | NULL | no |
| `ProjectDecision` | `latestEvaluationId` | `String?` | NULL | yes |
| `CommunicationThread` | `simulationId` | `String?` | NULL | yes |
| `CommunicationThread` | `envelopeKind` | `String?` | NULL | yes |
| `HermesMessage` | `simulationId` | `String?` | NULL | yes |
| `KnowledgeEntry` | `simulationId` | `String?` | NULL | yes |
| `KnowledgeEntry` | `visibilityScope` | `String?` | `'TENANT'` | no |
| `MissionFeedItem` | `simulationId` | `String?` | NULL | yes |
| `ApprovalRequest` | `simulationId` | `String?` | NULL | yes |
| `Task` | `simulationId` | `String?` | NULL | yes |
| `Routine` | `simulationId` | `String?` | NULL | yes |

All fields are nullable. No defaults other than `NULL` (and `'TENANT'` for `visibilityScope`, which is a sensible production default).

## 7. Backward compatibility statement

After this migration:
- Production tenants see no new fields in the UI (the frontend ignores `simulationId` columns).
- Production queries return the same rows they returned before.
- The only new column with a non-null default is `visibilityScope='TENANT'` on `KnowledgeEntry`, and that is the desired production behavior anyway.
- No existing service or controller code is modified except where it explicitly needs to read the new fields (none in this slice).
- The `UserRole` enum is **unchanged** — `SYSTEM` was never added in this revision (rejected per revision 1).

## 8. Migration rollback

The migration is purely additive. New tables are created; existing tables get nullable columns; the `qualityScores` field is not added in the first place (so nothing to drop). The migration can be rolled back by dropping the new tables and dropping the new columns — no data is lost. Drop order:
1. Drop `IdempotencyRecord` table.
2. Drop `ServiceToken` table.
3. Drop `ServiceIdentity` table.
4. Drop `DecisionEvaluation` table.
5. Drop new columns from existing tables.

There is no data backfill; nothing to reverse.
