# Item 8: Vertical Slice Specification

This document is the exact end-to-end sequence for the vertical slice. The slice is the smallest possible simulation that exercises every architectural decision in items 1–7 and passes the acceptance gate in Item 10.

The slice is one day (day 1) of one simulation run, with one event injected, one decision made, one debate, one Devil's Advocate challenge, one approval, one task, one outcome event, and one auditor review. Everything is a real database record. Every call is a real API call. Every agent message is a real agent-runtime call.

## 1. Preconditions

1. The migration `20260717_simulation_5_honest_timeline_and_idempotency` has been applied.
2. The new fields on `ProjectDecision`, `CommunicationThread`, `HermesMessage`, `KnowledgeEntry`, `MissionFeedItem`, `ApprovalRequest`, `Task`, and `Routine` exist.
3. The `UserRole` enum is **unchanged** (no `SYSTEM` role; the `SYSTEM` approach was rejected in revision 1).
4. A `ServiceIdentity` with `name='simulation-5-engine-001'` and `scopes=['simulation-engine']` has been created for the tenant via `POST /api/v1/service-identities`. A `ServiceToken` has been issued and the plaintext token is held in the framework's in-memory store.
5. The agent runtime endpoint `POST /api/v1/agents/:agentId/invocations` supports structured output with the repair pass and schema validation (added in this slice).
6. The simulation framework's controllers are wired and registered in `app.module.ts`.
7. The frontend's simulation filters and overview drawer are wired and live.

## 2. Test personas

The vertical slice uses these agents (created via the existing agent creation API):

| Persona | Role | Type |
|---|---|---|
| Aria Chen | Executive Director | EXECUTIVE |
| Daniel Kim | Finance Manager | FUNCTIONAL |
| Dr. Lina Rodriguez | Nutrition Coordinator | FUNCTIONAL |
| Critic Voltaire | Devil's Advocate | DEVIL_ADVOCATE |
| Sceptic | Independent Auditor | AUDITOR |

The slice exercises 4 agents (excluding the auditor, which is also an agent but acts in a separate role).

The agents are real `Agent` records with `isSelected=true`, a system prompt, and a configured model (default `gpt-4o-mini` for the vertical slice, configurable per agent). The `llm` block in the version block is:

```json
{
  "provider": "openai",
  "providerVersion": "1.0.0",
  "model": "gpt-4o-mini",
  "modelVersion": "2024-07-18",
  "structuredOutputMode": "json_schema"
}
```

## 3. The sequence

### Step 0 — Set up the test tenant

The user logs into `https://hq.neurecore.com` as a tenant OWNER. (This is the same flow the user already used to inspect the previous "dishonest" run.)

The user (an `ADMIN` or `OWNER`) creates a `ServiceIdentity` for the framework:

```
POST /api/v1/service-identities
{
  "name": "simulation-5-engine-001",
  "scopes": ["simulation-engine"]
}
```

Then issues a service token:

```
POST /api/v1/service-identities/<id>/tokens
{
  "ttlSeconds": 3600
}
```

The framework holds the plaintext token in memory. From this point on, every call the framework makes uses this service token, not a user token.

### Step 1 — Create the simulation run

User calls:

```
POST /api/v1/simulations
Authorization: Bearer <user-jwt>
Idempotency-Key: sim://2026/07/17/neurocore/sim5/000001:create

{
  "name": "Simulation-5: AEIC — Vertical Slice",
  "seed": "SIM5-VS-001",
  "orgSlug": "neurocore",
  "framework": "sim5",
  "rng": { "algorithm": "xoshiro256**", "version": "1.0.0" },
  "versions": {
    "framework": "1.0.0",
    "schema": "v1",
    "scoring": "v1",
    "llm": { "provider": "openai", "providerVersion": "1.0.0", "model": "gpt-4o-mini", "modelVersion": "2024-07-18", "structuredOutputMode": "json_schema" },
    "engines": {
      "realityEngine": "1.0.0", "decisionEngine": "1.0.0", "debateEngine": "1.0.0",
      "devilAdvocate": "1.0.0", "approvalOrchestrator": "1.0.0", "taskOrchestrator": "1.0.0",
      "auditor": "1.0.0", "scoringService": "1.0.0"
    }
  },
  "engineConfig": {
    "realityEngineEnabled": true,
    "auditorEnabled": true,
    "devilAdvocateEnabled": true,
    "cascadeProbability": 0,
    "hallucinationProbability": 0,
    "hiddenInfoProbability": 0,
    "ethicsProbability": 0
  },
  "retentionDays": 30
}
```

The server:
1. Computes the `simulationId` URI: `sim://2026/07/17/neurocore/sim5/000001`. (The server-generated sequence is per-day, per-org, per-framework; the first call wins.)
2. Creates a `Project` record with `metadata.simulation.simulationId`, `metadata.simulation.versions`, `metadata.simulation.engineConfig`, and `tags=['simulation', 'simulation-5', 'vertical-slice']`.
3. Creates a `CommunicationThread` (the master control thread) with `contextType='Project'`, `contextId=<projectId>`, `simulationId='sim://2026/07/17/neurocore/sim5/000001'`, `envelopeKind='simulation_control'`.
4. Posts the first message in the control thread: `envelope.kind='simulation_created'`, with the simulationId, seed, and engine config.
5. Returns the response with the new `simulationId`, `simulationRunId`, `projectId`, and `controlThreadId`.

Database state after this step:
- 1 new `Project` row.
- 1 new `CommunicationThread` row (the control thread).
- 1 new `HermesMessage` row.
- 1 new `IdempotencyRecord` row.

### Step 2 — Run day 1

The framework (using the service token) calls:

```
POST /api/v1/simulations/sim%3A%2F%2F2026%2F07%2F17%2Fneurocore%2Fsim5%2F000001/days/1/run
Authorization: Bearer <service-token>
Idempotency-Key: sim://2026/07/17/neurocore/sim5/000001:day-1

{
  "expectedRngState": "<base64 state from previous step>",
  "expectedVersions": { ... },     // the same version block sent in Step 1
  "actorUserId": "<userId>"
}
```

The server's `ServiceIdentityGuard` verifies the token. The `RolesGuard` is bypassed. The day-run orchestrator compares `expectedVersions` to the run's stored versions; a mismatch returns 409 `VERSION_MISMATCH`.

The server's day-run orchestrator runs the engines in order:

#### 2.1 — Reality Engine injects one event

The Reality Engine:
1. Computes the day's events deterministically from the seed. For the vertical slice, we configure `cascadeProbability=0` and a fixed event for day 1 (`SUPPLIER_DELAY`, severity `HIGH`).
2. Creates a `TimelineEvent` row with:
   - `tenantId` from the simulation
   - `projectId` = the simulation Project's id
   - `simulationId` = the simulationId
   - `occurredAt` = day 1, 09:00 simulated
   - `category` = `SUPPLY_CHAIN`
   - `severity` = `HIGH`
   - `sourceType` = `SIMULATION_CONTROLLER`
   - `title` = "Primary RUTF supplier reports 5-day delivery delay"
    - `description` = "..." (engine-generated, real text from a structured template; not a hardcoded "fake" string)
    - `relatedEntityType` = `'Project'`, `relatedEntityId` = the simulation project
    - `status` = `VERIFIED` (because we are not using cascades in the slice)
    - `correlationId` = `corr-sim://2026/07/17/neurocore/sim5/000001-day-1-supplier-delay`
    - `metadata` = `{ simulationDay: 1, eventType: 'SUPPLIER_DELAY' }`
3. Creates a `MissionFeedItem` row that points at the event for the affected agents' queues.

Database state after 2.1: +1 `TimelineEvent`, +1 `MissionFeedItem`.

#### 2.2 — Decision Engine proposes a decision

The Decision Engine, triggered by the new event, calls the agent runtime with the Executive Director persona:

```
POST /api/v1/agents/<execDirAgentId>/invocations
Authorization: Bearer <service-account-jwt>
{
  "task": "A TimelineEvent of type SUPPLIER_DELAY was just created (id: <eventId>). Read it and produce a decision proposal.",
  "structuredOutputSchema": {
    "name": "DecisionProposal",
    "strict": true,
    "schema": {
      "type": "object",
      "required": ["title", "description", "category", "expectedOutcome", "confidenceEstimate", "evidenceRefs"],
      "properties": {
        "title": { "type": "string" },
        "description": { "type": "string" },
        "category": { "enum": ["STRATEGIC", "OPERATIONAL", "EMERGENCY", "FINANCIAL", "COMPLIANCE", "STAKEHOLDER", "CUSTOM"] },
        "expectedOutcome": { "type": "string" },
        "confidenceEstimate": { "type": "integer", "minimum": 0, "maximum": 100 },
        "evidenceRefs": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["entityType", "entityId", "retrievedAt", "verificationStatus"],
            "properties": {
              "entityType": { "type": "string" },
              "entityId": { "type": "string" },
              "version": { "type": "integer" },
              "retrievedAt": { "type": "string" },
              "verificationStatus": { "enum": ["VERIFIED", "UNVERIFIED", "CONTESTED"] }
            }
          }
        }
      }
    }
  },
  "contextRefs": [
    { "entityType": "TimelineEvent", "entityId": "<eventId>" }
  ],
  "metadata": { "simulationId": "sim://2026/07/17/neurocore/sim5/000001", "day": 1, "engine": "DecisionEngine" }
}
```

The agent runtime returns a structured output that has been schema-validated. The server stores the invocation record (provider, model, prompt version, token usage, latency, traceId) on the `HermesMessage` linked to the resulting `ProjectDecision`.

The Decision Engine then creates a `ProjectDecision` row with:
- `projectId` = the simulation Project
- `title`, `description`, `category`, `expectedOutcome`, `confidenceEstimate` from the agent output
- `status` = `PROPOSED`
- `simulationId` = the simulationId
- `evidenceRefs` = the agent's evidence refs
- `metadata.engineInvocationId` = the invocation id
- `createdByAgentId` = the Executive Director agent's id

Database state after 2.2: +1 `ProjectDecision`, +1 `HermesMessage` (the invocation record).

#### 2.3 — Debate Engine starts a debate

The Debate Engine calls the Finance Manager and Nutrition Coordinator agents in turn. For each, it invokes the agent runtime with a debate-prompt that includes the decision and asks for a structured response with `position`, `argument`, `evidenceRefs`, `confidence`.

The server creates:
- A `CommunicationThread` (the debate thread) with `contextType='ProjectDecision'`, `contextId=<decisionId>`, `simulationId=<sim5-...>`, `envelopeKind='ai_debate'`, `title='Deliberation: <decision.title>'`
- Two `ThreadParticipant` rows (one per agent, `participantType='AGENT'`)
- Two `HermesMessage` rows, each with `envelope.kind='debate_round'`, `round=1`, the agent's position, argument, evidence refs, and confidence. Each message is a real agent-runtime invocation; the message also stores the `provider`, `model`, `tokenUsage`, `latencyMs`, `traceId`.

The Debate Engine does **not** force consensus. In the vertical slice we run only one round to keep it small. (Phase 1.5 expands to 3 rounds.)

#### 2.4 — Devil's Advocate Engine challenges the decision

The Devil's Advocate Engine:
1. Selects a focus area (e.g. `RISKS`) by random draw seeded from the simulation RNG.
2. Calls the Devil's Advocate agent runtime with a Devil's Advocate prompt.
3. Receives a structured response: `{ area, challenge, evidenceRefs, alternativeSuggestion, severity }`.
4. Creates a `CommunicationThread` (the challenge thread) with `contextType='ProjectDecision'`, `contextId=<decisionId>`, `simulationId=<sim5-...>`, `envelopeKind='devil_advocate'`, `title='Devil's Advocate: <decision.title>'`.
5. Creates one `HermesMessage` (the challenge) with the envelope and the agent invocation metadata.

#### 2.5 — Approval Engine creates the approval request

The Approval Engine (which is a deterministic orchestrator, not an LLM call) creates an `ApprovalRequest` with:
- `resourceType` = `'ProjectDecision'`
- `resourceId` = the decision id
- `title` = `"Approval: <decision.title>"`
- `requiredRole` = `'OWNER'`
- `status` = `PENDING`
- `simulationId` = the simulationId
- `requestedById` = the service-account user id

#### 2.6 — Task Engine creates a task

The Task Engine creates a `Task` with:
- `title` = `"Execute decision: <decision.title>"`
- `status` = `PENDING`
- `priority` = `HIGH`
- `agentId` = the Executive Director agent (the simulated assignee)
- `linkedEntityType` = `'ProjectDecision'`, `linkedEntityId` = the decision id
- `simulationId` = the simulationId

#### 2.7 — Decision Engine finalizes the decision (after approval)

In the vertical slice, the user (acting as OWNER) approves via the UI or via:

```
POST /api/v1/simulations/<sim5-...>/approvals/<approvalId>/approve
Authorization: Bearer <user-jwt>
```

This is a real user action. The Approval Engine:
1. Sets the `ApprovalRequest.status` to `APPROVED`.
2. Transitions the `ProjectDecision.status` to `APPROVED`.
3. Creates a `TimelineEvent` of type `DECISION_FINALIZED` with `relatedEntityType='ProjectDecision'`, `relatedEntityId=<decisionId>`.

The day-run's `POST /simulations/.../days/1/run` call returns 200 once 2.1–2.6 complete. The user then runs the approval and the framework records the outcome (2.7) as a separate event in the timeline.

For the acceptance test, the approval happens **before** the day-run returns. The day-run accepts a `testApproval: { approvedByServiceIdentityId, note }` block that causes the service identity to approve the request on the user's behalf. This is the only place the framework short-circuits; it is explicitly allowed in the vertical slice to keep the test self-contained. The block is **not** allowed when `scoringVersion !== 'v1'` AND the request's `metadata.testMode !== true`. In production, the framework rejects the block. The block is recorded in the audit log with `actorType: 'SERVICE_IDENTITY'`.

#### 2.8 — Auditor Engine reviews the decision

The Auditor Engine:
1. Selects a challenge type (e.g. `SHOW_EVIDENCE`) deterministically.
2. Calls the Auditor agent runtime with an auditor prompt.
3. Receives a structured response: `{ question, expectedEvidenceTypes, severity }`.
4. Creates a `CommunicationThread` (the audit thread) with `contextType='ProjectDecision'`, `simulationId=<sim5-...>`, `envelopeKind='auditor_challenge'`, `title='Auditor review: <decision.title>'`.
5. Creates a `HermesMessage` with the challenge envelope.
6. The Auditor does **not** respond on behalf of the AI workforce. Instead, it records a `KnowledgeEntry` (type `AUDIT_FINDING`) summarizing the review once the user (or another agent) responds. For the vertical slice, we record the audit as a `KnowledgeEntry` immediately after the challenge is posted, with `metadata.auditStatus='PENDING_RESPONSE'`. The day-run returns at this point.

### Step 3 — Day-run returns

The day-run response:

```json
{
  "day": 1,
  "status": "COMPLETED",
  "replayed": false,
  "rngStateAfter": "<base64>",
  "created": {
    "timelineEvents": [
      { "id": "<eventId>", "type": "SUPPLIER_DELAY", "title": "..." },
      { "id": "<finalizedEventId>", "type": "DECISION_FINALIZED", "title": "..." }
    ],
    "decisions": [
      { "id": "<decisionId>", "title": "..." }
    ],
    "threads": [
      { "id": "<debateThreadId>", "kind": "ai_debate", "title": "Deliberation: ..." },
      { "id": "<devilsAdvocateThreadId>", "kind": "devil_advocate", "title": "Devil's Advocate: ..." },
      { "id": "<auditorThreadId>", "kind": "auditor_challenge", "title": "Auditor review: ..." }
    ],
    "approvals": [
      { "id": "<approvalId>", "decisionId": "<decisionId>", "status": "APPROVED" }
    ],
    "tasks": [
      { "id": "<taskId>", "decisionId": "<decisionId>", "title": "Execute decision: ..." }
    ],
    "knowledgeEntries": [
      { "id": "<auditFindingId>", "type": "AUDIT_FINDING", "title": "..." }
    ],
    "feedItems": [
      { "id": "<feedItemId>", "title": "..." }
    ]
  },
  "scores": null,
  "durationMs": 12450
}
```

The day-run does **not** compute scores yet. Scoring happens in Step 4.

The day-end step also writes a `KnowledgeEntry` of type `TIMING_METRICS` containing the day's p50/p95/max for `timeToDecision`, `timeToApproval`, `timeToResolution`. With only one decision, this entry contains a single data point per metric; the rolling window grows over time.

### Step 4 — Compute running scores

The user (or the framework in a follow-up call) requests:

```
GET /api/v1/simulations/<sim5-...>/scores
```

The deterministic scoring service reads all the records created in the slice and computes the split scorecard. For day 1 with the minimum possible evidence:

- `organizationalIntelligence.decisionQuality`: based on the agent's `confidenceEstimate` and the evidence refs that resolve.
- `organizationalIntelligence.evidenceQuality`: based on the count of `VERIFIED` evidence refs.
- `organizationalIntelligence.aiCollaboration`: based on the existence of the debate thread and the participants' structured responses.
- `organizationalIntelligence.predictionAccuracy`: `null` (no outcome recorded yet, so no prediction can be realized).
- ... (other organizational categories return null for day 1 because there is not enough evidence yet)
- `platformHealth.apiLatency`, `platformHealth.llmHealth`, etc.: read from the observability stack. Real values, not null.
- `timing`: contains the day's timing metrics from the `TIMING_METRICS` `KnowledgeEntry`.
- `productionReady`: `false` (organizationalIntelligence.overall is null or below 75).

The response is the score envelope from `05-api-contracts.md` §4.1. The scores are persisted as a `DecisionEvaluation` row per decision (with `evaluationKind='INITIAL'`) and a `KnowledgeEntry` of type `RUNNING_SCORES` for the run-level score. The simulation Project's `metadata.simulation.lastScores` is updated.

### Step 5 — UI verification

The user opens `https://hq.neurecore.com`, navigates to the simulation Project, and sees:

- The control thread in the project's threads list, with `🧪 Simulation` badge.
- The supplier delay TimelineEvent in the project's timeline.
- The decision in the project's decisions list, with the evidence refs and the `🧪 Simulation` badge.
- The debate, Devil's Advocate, and auditor threads in the project's threads, all with `🧪 Simulation` badge.
- The approval in the project's approvals.
- The task in the project's tasks.
- The mission feed item in the relevant agent's queue (or the simulation overview drawer since mission feed items are filtered by default).
- The running scores in the simulation overview drawer.

Every record is queryable via the existing API endpoints. None of them are in local JSON files.

## 4. Database state at the end of the slice

Total new records:
- 1 `Project`
- 1 `CommunicationThread` (control)
- 3 `CommunicationThread` (debate, Devil's Advocate, auditor)
- 2 `TimelineEvent` (supplier delay, decision finalized)
- 1 `ProjectDecision`
- 1 `DecisionEvaluation` (the INITIAL evaluation of the decision)
- 1 `ApprovalRequest`
- 1 `Task`
- 1 `KnowledgeEntry` (audit finding)
- 1 `KnowledgeEntry` (running scores)
- 1 `KnowledgeEntry` (timing metrics)
- 1 `MissionFeedItem`
- 1 `IdempotencyRecord` (create)
- 1 `IdempotencyRecord` (day-1)
- 1 `ServiceIdentity` (created in Step 0)
- 1 `ServiceToken` (issued in Step 0)
- 6 `HermesMessage` (control-created, debate x2, Devil's Advocate, auditor, decision invocation)
- 2 `ThreadParticipant` (debate agents)

All records are tagged with `simulationId='sim://2026/07/17/neurocore/sim5/000001'`. None of them are in local files.

## 5. What the acceptance test will assert (preview)

The acceptance test in `10-acceptance-gate-test.md` will assert, in order:
1. All records exist in the database (queried via Prisma, not via the API).
2. Each record carries the expected `simulationId` URI.
3. The `ServiceIdentity` and `ServiceToken` exist and the token is valid.
4. The simulation Project's `metadata.simulation.versions` matches what was sent in Step 1.
5. Each `evidenceRefs` on the `ProjectDecision` resolves to an existing `TimelineEvent` (or `KnowledgeEntry`) belonging to the same tenant.
6. The agent runtime was called for the decision, debate, Devil's Advocate, and auditor (via `HermesMessage.metadata` containing a structured output that validates against the expected schema; with the repair pass, at most 2 attempts per call).
7. A `DecisionEvaluation` exists for the decision with `evaluationKind='INITIAL'` and `scoringVersion='v1'`.
8. A `KnowledgeEntry` of type `TIMING_METRICS` exists.
9. A `KnowledgeEntry` of type `RUNNING_SCORES` exists.
10. A second day-run with the same `Idempotency-Key` returns the same body with `replayed: true` and does not create new records.
11. A second day-run with the same key but a different `expectedRngState` returns 422.
12. A day-run with a different `expectedVersions` returns 409 `VERSION_MISMATCH`.
13. A run with the same seed and same versions produces the same outcomes (deterministic).
14. A different tenant cannot retrieve any of the records (404).
15. A cross-tenant call to the service-identity auth path returns 403 `SERVICE_IDENTITY_SCOPE_INSUFFICIENT`.
16. The audit log contains the expected actor entries: USER for the create, SERVICE_IDENTITY for the day-run and engine calls, AGENT for each invocation.
17. The browser-visible UI matches the API-returned records (asserted by a Playwright test).
18. The numeric score is computed only from persisted records (no fallback constants).
19. The split scorecard contains both `organizationalIntelligence` and `platformHealth` sections.
20. The score envelope includes the timing block with p50/p95/max for the day's metrics.

## 6. Out of scope for the slice

The vertical slice does **not** include:
- Cascades (the slice's event is a single SUPPLIER_DELAY with no cascade)
- Hallucination tests
- Hidden-information tests
- Ethics dilemmas
- Counterfactual analyses (these require the decision to be evaluated after some time, not at decision time)
- Confidence realizations (requires an outcome event later in time)
- Learning updates (requires weeks of run history)
- Executive scorecards (requires multiple decisions per agent)
- Department reviews (requires the routine to complete)
- The full 60-day loop (we run only day 1; Phase 1.5 expands)
- The other 16 event types in the Reality Engine (the slice uses only SUPPLIER_DELAY; the rest are added in Phase 1.5)
- Multiple debate rounds (the slice runs 1 round; Phase 1.5 runs 3)
- Multi-tenant tests (the slice is single-tenant; Phase 1.5 tests cross-tenant isolation)
