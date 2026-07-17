# Item 2: Entity Mapping Audit

This document is the authoritative mapping from every concept in the simulation-5 plan to a real NeuroCore entity. For each concept it specifies: the chosen entity, the fields that will be used, the fields that need to be added (and to which existing table), the relations, and the containment rules for synthetic data.

The "Fields to add" column lists only fields that are needed and do not exist today. All other fields already exist.

---

## Summary

| Concept | Chosen entity | New fields needed | Notes |
|---|---|---|---|
| Simulation run state | `Project` (tagged) | None — uses `metadata` | A dedicated `ScenarioRun` table may be added later, but not now |
| Master control surface | `CommunicationThread` | `simulationId`, `simulationMetadata` | Holds seed, RNG state, day checkpoint, engine config |
| Decision (authoritative) | `ProjectDecision` | `simulationId`, `expectedOutcome`, `actualOutcome`, `confidenceEstimate`, `counterfactualBest`, `lessonsLearned`, `evidenceRefs`, `latestEvaluationId` | These fields are production-useful, not simulation-only. Scores live on `DecisionEvaluation` (separate table); the decision row stores only `latestEvaluationId` for fast lookup. |
| Decision deliberation | `CommunicationThread` (linked to decision) | `simulationId` | A debate, not a commitment |
| Board meeting (event) | `Routine` (schedule) + `CommunicationThread` (minutes) + `Task` (action items) | `simulationId` on each | A meeting is a scheduled routine, with minutes as a thread, with action items as tasks |
| AI debate | `CommunicationThread` with `participantType=AGENT` | `simulationId` | Participants are agents, not humans |
| Timeline event | **`TimelineEvent`** (new) | (the whole table) | The only new event log. Real production concept. |
| Failure cascade | Parent-child `TimelineEvent` chain | `parentEventId`, `rootEventId`, `correlationId` | Cascades are event chains, not a separate entity |
| Mission / feed item | `MissionFeedItem` | `simulationId` | A user-facing nudge about a decision or event |
| Auditor challenge | `CommunicationThread` (linked to decision or event) | `simulationId`, `envelope.kind='auditor_challenge'` | A real audit trail is a thread |
| Devil's Advocate challenge | `CommunicationThread` (linked to decision) | `simulationId`, `envelope.kind='devil_advocate'` | Same shape as auditor |
| Hallucination test | `CommunicationThread` (in control thread), not Knowledge | `simulationId`, `envelope.kind='hallucination'` | The fake claim is the test content, never in Knowledge |
| Hidden-information test | `CommunicationThread` (in control thread) + restricted `KnowledgeEntry` | `simulationId`, `envelope.kind='hidden_info'` | The "hidden" knowledge is in a real Knowledge entry with restricted visibility |
| Ethics dilemma | `CommunicationThread` (deliberation) + `ApprovalRequest` (gate) + `ProjectDecision` (commitment) | `simulationId` on each | Three-stage flow |
| Counterfactual | `KnowledgeEntry` (type=`counterfactual`, linked to decision) | `simulationId`, `link.entityType='ProjectDecision'` | Real organizational knowledge |
| Confidence prediction | `ProjectDecision.confidenceEstimate` + `KnowledgeEntry` (realization record) | `simulationId` | The prediction lives on the decision; the realization is a Knowledge entry that references the decision |
| Learning update | `Routine` (weekly) producing versioned `KnowledgeEntry` | `simulationId` | Real weekly review |
| Executive scorecard | `KnowledgeEntry` (type=`report`, linked to agent) | `simulationId` | A report, persisted as knowledge |
| Department review | `KnowledgeEntry` (type=`report`, linked to department) | `simulationId` | Same |
| Idempotency | **`IdempotencyRecord`** (new, revised) | (the whole table) | A real production primitive |
| Decision evaluation | **`DecisionEvaluation`** (new) | (the whole table) | One row per evaluation; immutable scores snapshot per `scoringVersion`; replaces the dropped `ProjectDecision.qualityScores` JSON column |
| Service identity (engine, webhook, scheduled job) | **`ServiceIdentity`** + **`ServiceToken`** (new) | (the whole tables) | Not a `User`; first-class concept for workloads. Rejected the `SYSTEM` role approach. |

**Five new tables: `TimelineEvent`, `IdempotencyRecord`, `DecisionEvaluation`, `ServiceIdentity`, `ServiceToken`.** Everything else is existing entities with optional nullable `simulationId` columns added in a backward-compatible migration. The `UserRole` enum is unchanged. `ServiceToken` is a child of `ServiceIdentity` (a token belongs to one identity) but is its own table because tokens are short-lived and high-volume; co-locating them on the identity row would bloat the row.

---

## Detailed Mappings

### 1. Simulation run state — represented as a `Project`

| Aspect | Value |
|---|---|
| Entity | `Project` |
| Project type | A dedicated project named e.g. `Simulation-5: AEIC — Honest Run <seed>` |
| Project status | `ACTIVE` while running, `COMPLETED` when finalized |
| Project metadata | The simulation control state (see below) |
| Project tags | `["simulation", "simulation-5", "honest-run"]` |

Project `metadata` shape:
```json
{
  "simulation": {
    "schemaVersion": "v1",
    "seed": "SIM5-2026-001",
    "rngAlgorithm": "xoshiro256**",
    "rngState": "<base64>",
    "currentDay": 0,
    "currentPhase": "init",
    "engineConfig": {
      "realityEngineEnabled": true,
      "auditorEnabled": true,
      "devilAdvocateEnabled": true,
      "cascadeProbability": 0.3,
      "scoringVersion": "v1"
    },
    "checkpoints": [
      { "day": 0, "ts": "...", "rngState": "..." }
    ],
    "scoringVersion": "v1"
  }
}
```

The control Thread (next item) is the runtime surface; the Project is the durable identity. The Project never moves out of `ACTIVE` until the run is finalized; the run state is fully reconstructible from the Project metadata + the control Thread + the linked records.

### 2. Master control surface — `CommunicationThread`

| Aspect | Value |
|---|---|
| Entity | `CommunicationThread` |
| `title` | `Simulation-5 Control: <simulationId>` |
| `contextType` | `'Project'` |
| `contextId` | The simulation Project's id |
| `status` | `ACTIVE` |
| Participants | The simulation engines (as agents); only engines can post |
| New field on `CommunicationThread` | `simulationId String? @index` |

Messages in this thread have a typed envelope shape:
```typescript
type ControlEnvelope =
  | { kind: 'day_start', day: number, seed: string }
  | { kind: 'day_end', day: number, summary: string, scores: Record<string, number> }
  | { kind: 'engine_config', config: EngineConfig }
  | { kind: 'checkpoint', day: number, rngState: string, ts: string }
  | { kind: 'seed_reset', newSeed: string }
  | { kind: 'synthetic_claim', claim: string, realityEngineKnowsIsFake: true }
  | { kind: 'synthetic_claim_invalidated', claimId: string }
```

These messages are not part of normal retrieval. They are queried by the simulation control endpoint and by the audit log. They never enter the standard Hermes message index used by chat.

### 3. Decision — `ProjectDecision` (authoritative)

| Aspect | Value |
|---|---|
| Entity | `ProjectDecision` (existing) |
| Existing fields | `title`, `description`, `status`, `decidedAt`, `approvedById`, `approvedByType`, `votesFor/Against/Abstentions`, `meetingNotes`, `rationale`, `effectiveDate`, `expiryDate`, `supersededBy`, `linkedEntityType`, `linkedEntityId`, `metadata` |
| **New fields** | `simulationId String? @index`, `expectedOutcome String? @db.Text`, `actualOutcome String? @db.Text`, `confidenceEstimate Int?` (0-100), `counterfactualBest String? @db.Text`, `lessonsLearned String? @db.Text`, `evidenceRefs Json?` (array of `{ entityType, entityId, version, retrievedAt, verificationStatus }`), `latestEvaluationId String? @index` (pointer to the latest `DecisionEvaluation` row) |

The new fields are nullable, all production-useful (a real customer might want to record `expectedOutcome` and `actualOutcome` for any decision; a real customer might want `confidenceEstimate` for any decision a manager has to make under uncertainty). They are not simulation-specific.

`metadata` will hold simulation-specific tags like `{"simulationSeed": "...", "simulationDay": 12, "engine": "RealityEngine", "engineVersion": "v1"}` for records created during a simulation. The same `metadata` field can also hold non-simulation tags, and existing services that read `metadata` will see no new required fields.

### 4. Decision deliberation — `CommunicationThread` linked to a decision

| Aspect | Value |
|---|---|
| Entity | `CommunicationThread` |
| `contextType` | `'ProjectDecision'` |
| `contextId` | The `ProjectDecision.id` |
| Participants | The agents involved in the deliberation, plus optionally the Devil's Advocate (as a separate participant) |
| `title` | `Deliberation: <decision.title>` |

Each message in this thread is a real agent-runtime call (see "Real agent-runtime calls" below). There is no freeform prose; each message has a structured envelope with `kind`, `position`, `argument`, `evidenceRefs[]`, `confidence`.

### 5. Board meeting — `Routine` + `CommunicationThread` + `Task`s

A board meeting is not a single entity; it is a coordinated set of three:

| Piece | Entity | Purpose |
|---|---|---|
| Schedule | `Routine` (a "weekly board meeting" routine) | Defines cadence, attendees, agenda template |
| Minutes | `CommunicationThread` (linked to the routine run) | Real-time deliberation during the meeting |
| Action items | `Task` records, each linked to the thread | The actual work assigned to agents |

The simulation framework will use a pre-existing `Routine` template `simulation-5-board-meeting` and trigger a routine run on the right cadence. The minutes thread is `contextType='RoutineRun'`, `contextId=<routineRun.id>`. Action items are `Task` records with `linkedEntityType='RoutineRun'`.

### 6. AI debate — `CommunicationThread` with agent participants

| Aspect | Value |
|---|---|
| Entity | `CommunicationThread` |
| `contextType` | `'ProjectDecision'` (the decision being debated) |
| `contextId` | The decision id |
| Participants | Two or more agents, with `participantType='AGENT'` and the role stored in `role` |
| New field on `ThreadParticipant` | `role String?` (already exists, will be used to store the role like `'EXECUTIVE'`, `'FINANCE'`, `'DEVIL_ADVOCATE'`) |

A debate is a thread with structured messages. Each message is produced by a real agent-runtime call; the message envelope has `kind: 'debate_round'`, `round: 1..3`, `position: 'SUPPORT'|'OPPOSE'|'ABSTAIN'`, `argument: string`, `evidenceRefs: [{entityType, entityId}]`, `confidence: number`. The status of the debate (consensus reached or escalated) is recorded in the thread's `metadata`.

### 7. Timeline event — NEW `TimelineEvent` table

See `03-timeline-event-schema.md` for the full schema. In short:

| Aspect | Value |
|---|---|
| Entity | `TimelineEvent` (new) |
| Tenant | Required |
| Project | Optional, but most events have one |
| Simulation | Optional, set for simulation-injected events |
| `occurredAt` | When the event happened in the simulated/production world |
| `recordedAt` | When we wrote the record |
| `category` | `OPERATIONAL`, `SUPPLY_CHAIN`, `SECURITY`, `COMPLIANCE`, `FINANCIAL`, `STAKEHOLDER`, `HR`, `WEATHER`, `EXTERNAL`, `AI_ACTION`, `SIMULATION`, `CUSTOM` |
| `severity` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `sourceType` | `HUMAN`, `AI`, `INTEGRATION`, `SYSTEM`, `SIMULATION_CONTROLLER` |
| `sourceId` | Optional reference to the actor |
| `title`, `description` | Short and long form |
| `relatedEntityType`, `relatedEntityId` | Optional reference to a Decision, Task, etc. |
| `parentEventId`, `rootEventId` | For cascades |
| `correlationId`, `traceId`, `causationId` | For distributed tracing |
| `status` | `DRAFT`, `REPORTED`, `VERIFIED`, `ACTIVE`, `RESOLVED`, `INVALIDATED`, `FAILED` |
| `metadata` | JSON for engine-specific extras |

Cascades are not a separate entity. They are a chain of `TimelineEvent`s linked by `parentEventId`. The two-phase creation rule (all `DRAFT`, validate, then atomic publish as `VERIFIED` or `ACTIVE`) lives in the engine layer, not the schema.

### 8. Failure cascade — `TimelineEvent` chain

A cascade is created by:
1. Writing all child events with `parentEventId` set and `status='DRAFT'`.
2. Validating the full chain (no orphans, severity ordering, all parents exist).
3. On success, atomically transitioning all to `VERIFIED` or `ACTIVE`.
4. On failure, transitioning all to `FAILED` and excluding them from operational views (a default filter on `status NOT IN ('DRAFT', 'FAILED')`).

### 9. Mission / feed item — `MissionFeedItem`

| Aspect | Value |
|---|---|
| Entity | `MissionFeedItem` (existing) |
| `entityType`, `entityId` | Point at the underlying Decision or TimelineEvent |
| `sourceEventId` | Set to the TimelineEvent id (existing field, no change) |
| `actionPayload` | Holds the deep-link to the underlying record |
| New field | `simulationId String? @index` |

Mission feed items are user-facing nudges. A "supplier delayed" TimelineEvent causes a MissionFeedItem to appear for the relevant role. Mission feed items tagged with a non-null `simulationId` are visible in the simulation overview drawer.

### 10. Auditor challenge — `CommunicationThread` linked to a decision or event

Same shape as a decision deliberation thread. The thread has `envelope.kind='auditor_challenge'`. The opening message is a real agent-runtime call. The challenge question is structured: `{ kind, question, expectedEvidenceTypes, severity, dueBy }`.

### 11. Devil's Advocate challenge — `CommunicationThread` linked to a decision

Same as auditor, but `envelope.kind='devil_advocate'` and the opening message is produced by an agent with the Devil's Advocate role.

### 12. Hallucination test — restricted `CommunicationThread` in the control thread

A hallucination test is a message in the control thread (or a dedicated sub-thread for tests) with `envelope.kind='hallucination'`. The synthetic claim is **never** inserted into `KnowledgeEntry`. The agent that receives the claim receives it through the test interaction only.

After the test resolves, the message is annotated with `invalidationStatus='INVALIDATED'` so a future scan can confirm no claims were promoted to organizational truth. The audit log records the test, the agent response, and the invalidation.

### 13. Hidden-information test — restricted `KnowledgeEntry` plus a `CommunicationThread`

The "hidden" fact is a real `KnowledgeEntry` with a tight visibility scope. The simulation framework sets `metadata.visibility='simulation_only'` and `simulationId=<id>`. The agent is told about the fact only through the test interaction (a message in the test thread). Default Knowledge retrieval queries filter out `metadata.visibility='simulation_only'` rows.

### 14. Ethics dilemma — three-stage flow

| Stage | Entity | What it is |
|---|---|---|
| Dilemma prompt | `CommunicationThread` (linked to decision being considered) | The dilemma, options, principles |
| Decision | `ProjectDecision` | The proposed decision after deliberation |
| Approval | `ApprovalRequest` | The ethical gate, with a required role (e.g. `OWNER` or `AUDITOR`) |

The framework creates the dilemma message, the decision is deliberated, then an `ApprovalRequest` is submitted before the decision can transition to `APPROVED`. If the request is rejected, the decision is moved to `REJECTED` and a `TimelineEvent` records the rejection.

### 15. Counterfactual — `KnowledgeEntry` linked to a decision

| Aspect | Value |
|---|---|
| Entity | `KnowledgeEntry` |
| `type` | `COUNTERFACTUAL` (already in the enum or added) |
| `metadata` | `{ simulationId, relatedDecisionId, alternativeOption, probabilityEstimate, wouldImprove, agentId }` |

A counterfactual is real organizational knowledge (a manager might genuinely want to record "if we had chosen Option B, the outcome might have been different"). It is filterable like any other Knowledge entry.

### 16. Confidence prediction — stored on the `ProjectDecision` + `KnowledgeEntry` realization

| Aspect | Value |
|---|---|
| Initial prediction | `ProjectDecision.confidenceEstimate` (new field) |
| Realization | `KnowledgeEntry` with `type='CONFIDENCE_REALIZATION'`, referencing the decision id |

This is a clean production shape: every decision has a confidence estimate (very useful for real customers), and over time, realizations are recorded as evidence of how calibrated the organization is.

### 17. Learning update — `Routine` producing a `KnowledgeEntry`

| Aspect | Value |
|---|---|
| Entity | `Routine` (template `simulation-5-weekly-learning`) |
| Output | A `KnowledgeEntry` with `type='LEARNING_UPDATE'`, `metadata={simulationId, weekNumber, changedAssumptions[], newRisksIdentified[], invalidatedRisks[]}` |

Real organizations do weekly learning reviews; the simulation exercises the same primitive.

### 18. Executive scorecard — `KnowledgeEntry` linked to an agent

| Aspect | Value |
|---|---|
| Entity | `KnowledgeEntry` |
| `type` | `AI_SCORECARD` |
| `metadata` | `{ simulationId, agentId, scores: {...}, trend }` |

### 19. Department review — `KnowledgeEntry` linked to a department

Same as scorecard, with `type='DEPARTMENT_REVIEW'`.

### 20. Idempotency — NEW `IdempotencyRecord` table

See `03-timeline-event-schema.md` and `07-idempotency-strategy.md`. The full schema is:

| Field | Type | Notes |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `tenantId` | `String` | Required, indexed |
| `key` | `String` | The idempotency key supplied by the client |
| `requestHash` | `String` | SHA-256 of the canonical request body |
| `requestPath` | `String` | The endpoint that was called |
| `status` | `IdempotencyStatus` enum: `IN_FLIGHT`, `COMPLETED`, `FAILED` | |
| `responseStatus` | `Int?` | HTTP status of the original call |
| `responseBody` | `Json?` | The full response body of the original call |
| `resultEntityType` | `String?` | Optional pointer to a created entity (e.g. `'TimelineEvent'`) |
| `resultEntityId` | `String?` | The created entity's id |
| `expiresAt` | `DateTime` | TTL (default 24h) |
| `createdAt` | `DateTime` | |
| `updatedAt` | `DateTime` | |
| Unique | `@@unique([tenantId, key])` | |

---

## New Fields to Add to Existing Tables

These are the only schema changes needed (besides the five new tables):

| Table | New field | Type | Notes |
|---|---|---|---|
| `ProjectDecision` | `simulationId` | `String? @index` | Nullable, unused in production |
| `ProjectDecision` | `expectedOutcome` | `String? @db.Text` | Production-useful |
| `ProjectDecision` | `actualOutcome` | `String? @db.Text` | Production-useful |
| `ProjectDecision` | `confidenceEstimate` | `Int?` | 0-100, production-useful |
| `ProjectDecision` | `latestEvaluationId` | `String? @index` | Pointer to the latest `DecisionEvaluation` row |
| `ProjectDecision` | `counterfactualBest` | `String? @db.Text` | production-useful |
| `ProjectDecision` | `lessonsLearned` | `String? @db.Text` | production-useful |
| `ProjectDecision` | `evidenceRefs` | `Json?` | production-useful |
| `CommunicationThread` | `simulationId` | `String? @index` | Nullable |
| `CommunicationThread` | `envelopeKind` | `String? @index` | Optional typed-envelope discriminator |
| `HermesMessage` | `simulationId` | `String? @index` | Nullable, used by filters |
| `KnowledgeEntry` | `simulationId` | `String? @index` | Nullable, used by filters |
| `KnowledgeEntry` | `visibilityScope` | `String?` | New enum, default `'TENANT'` |
| `MissionFeedItem` | `simulationId` | `String? @index` | Nullable |
| `ApprovalRequest` | `simulationId` | `String? @index` | Nullable |
| `Task` | `simulationId` | `String? @index` | Nullable |
| `Routine` | `simulationId` | `String? @index` | Nullable, used to scope simulation routines |

All new fields are nullable and unused in production. No existing query, service, or UI changes. The simulation framework writes them; production code ignores them.
