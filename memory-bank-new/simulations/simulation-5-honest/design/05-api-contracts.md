# Item 5: API Contracts

This document is the full request/response shape for every endpoint the simulation-5 framework exposes in Phase 1. The vertical slice implementation must match these shapes exactly.

All endpoints are tenant-scoped (the existing `TenantContextGuard` enforces this). The simulation framework's own endpoints are added under a new `/api/v1/simulations` prefix.

## 1. Simulation run lifecycle

### 1.1 Create a simulation run

```
POST /api/v1/simulations
```

Creates a `Project` with the simulation tag, a master control `CommunicationThread`, and the initial project metadata (seed, RNG state, day 0, engine config, version block).

**Request body:**
```typescript
{
  name: string;                            // e.g. "Simulation-5: AEIC — Honest Run"
  seed: string;                            // e.g. "SIM5-2026-001"
  orgSlug: string;                         // e.g. "neurocore" (part of the simulationId URI)
  framework: string;                       // e.g. "sim5" (part of the simulationId URI)
  rng: { algorithm: 'xoshiro256**' | 'mulberry32'; version: string };   // default algorithm; version is required
  versions: {                              // the version block; see 04-simulation-tagging-rules.md §8
    framework: string;                     // e.g. "1.0.0"
    schema: string;                        // e.g. "v1"
    scoring: string;                       // e.g. "v1"
    llm: {
      provider: string;                    // e.g. "openai"
      providerVersion: string;             // e.g. "1.0.0"
      model: string;                       // e.g. "gpt-4o-mini"
      modelVersion: string;                // e.g. "2024-07-18"
      structuredOutputMode: 'json_schema' | 'json_object';
    };
    engines: {
      realityEngine: string;
      decisionEngine: string;
      debateEngine: string;
      devilAdvocate: string;
      approvalOrchestrator: string;
      taskOrchestrator: string;
      auditor: string;
      scoringService: string;
    };
  };
  engineConfig: {
    realityEngineEnabled: boolean;
    auditorEnabled: boolean;
    devilAdvocateEnabled: boolean;
    cascadeProbability: number;            // 0..1
    hallucinationProbability: number;       // 0..1
    hiddenInfoProbability: number;         // 0..1
    ethicsProbability: number;             // 0..1
  };
  customerId?: string;                     // optional customer link
  parentProjectId?: string;                // optional: run as a sub-project
  retentionDays?: number;                  // default 90
}
```

**Response (201):**
```typescript
{
  simulationId: string;                    // the URI: sim://YYYY/MM/DD/<orgSlug>/<framework>/<seq>
  simulationRunId: string;                 // the database row id (cuid)
  projectId: string;                       // the simulation Project
  controlThreadId: string;                 // the master control CommunicationThread
  status: 'PENDING';
  currentDay: 0;
  versions: { ... };                       // the version block as stored
  createdAt: string;
}
```

**Error codes:**
- 400 INVALID_REQUEST — body shape invalid
- 400 INVALID_SIMULATION_ID — server-computed simulationId URI shape invalid (defensive)
- 409 SIMULATION_ALREADY_RUNNING — a non-finalized run with the same seed exists
- 403 PERMISSION_DENIED — user is not OWNER/ADMIN

### 1.2 Get a simulation run

```
GET /api/v1/simulations/:simulationId
```

**Response (200):**
```typescript
{
  simulationId: string;                    // the URI
  simulationRunId: string;                 // the database row id
  projectId: string;
  controlThreadId: string;
  status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'ABORTED';
  currentDay: number;
  seed: string;
  rng: { algorithm: string; version: string };
  versions: { ... };                       // the version block
  engineConfig: { ... };
  startedAt: string | null;
  completedAt: string | null;
  retentionDays: number;
  scores: {                                // see §4.1 for the full shape
    organizationalIntelligence: { ... },
    platformHealth: { ... },
    productionReady: boolean;
  } | null;
  counts: {
    timelineEvents: number;
    decisions: number;
    debates: number;
    threads: number;
    approvals: number;
    tasks: number;
    knowledgeEntries: number;
  };
}
```

### 1.3 List simulation runs

```
GET /api/v1/simulations
```

Supports `?status=`, `?seed=`, `?limit=`, `?cursor=`.

### 1.4 Finalize a simulation run

```
POST /api/v1/simulations/:simulationId/finalize
```

Computes the deterministic final score, marks the run `COMPLETED`, and creates the production-equivalent of the 15 deliverables as actual records (Knowledge entries, decisions, threads) tagged with the simulationId. No new files are produced.

**Response (200):** the same shape as `GET /api/v1/simulations/:simulationId`, with `status: 'COMPLETED'`, `completedAt: <ts>`, and `scores` populated.

**Error codes:**
- 409 SIMULATION_NOT_READY — currentDay < 60 or some other readiness check fails
- 409 SIMULATION_ALREADY_FINALIZED — status is already COMPLETED
- 422 SCORING_VALIDATION_FAILED — persisted evidence is missing required fields; cannot score

## 2. Day-run execution (the main loop)

### 2.1 Run one day

```
POST /api/v1/simulations/:simulationId/days/:day/run
```

Executes the engines for one day. Idempotent by `Idempotency-Key` header. The framework authenticates with a service token (see §5).

**Headers:**
- `Idempotency-Key: <key>` — required. Format: `<simulationId>:day-<N>:<engine-anchor>`. See `07-idempotency-strategy.md`.
- `Authorization: Bearer <service-token>` — required. The framework's service identity token.

**Request body:**
```typescript
{
  expectedRngState: string;                // base64; the client must send the current RNG state
  expectedVersions: { ... };               // the version block; must match the run's stored versions
  actorUserId: string;                     // the human user who initiated this day (for audit)
}
```

**Response (200):**
```typescript
{
  day: number;
  status: 'COMPLETED' | 'REPLAYED';
  replayed: boolean;                       // true if served from IdempotencyRecord
  rngStateAfter: string;                   // base64
  created: {
    timelineEvents: Array<{ id: string, type: string, title: string }>;
    decisions: Array<{ id: string, title: string, latestEvaluationId: string | null }>;
    threads: Array<{ id: string, kind: string, title: string }>;
    approvals: Array<{ id: string, decisionId: string, status: string }>;
    tasks: Array<{ id: string, decisionId: string, title: string }>;
    knowledgeEntries: Array<{ id: string, type: string, title: string }>;
    feedItems: Array<{ id: string, title: string }>;
    decisionEvaluations: Array<{ id: string, decisionId: string, kind: string }>;
  };
  scores: { ... } | null;                 // updated running scores, or null if scoring requires the day to be completed
  timing: { ... } | null;                 // updated timing metrics, written to a TIMING_METRICS KnowledgeEntry on day-end
  durationMs: number;
}
```

**Error codes:**
- 400 INVALID_REQUEST — body invalid
- 400 INVALID_SIMULATION_ID — server-computed simulationId URI shape invalid
- 401 UNAUTHORIZED — missing/invalid token
- 403 PERMISSION_DENIED — caller is not a valid service identity
- 403 SERVICE_IDENTITY_SCOPE_INSUFFICIENT — caller's service identity lacks `simulation-engine` scope
- 409 SIMULATION_NOT_FOUND
- 409 SIMULATION_FINALIZED — day-run after finalize
- 409 DAY_ALREADY_RUN — no Idempotency-Key supplied, and the day has been run before
- 409 VERSION_MISMATCH — `expectedVersions` does not match the run's stored versions; the user must create a new run
- 422 RNG_STATE_MISMATCH — `expectedRngState` does not match the server's current state
- 422 IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD — same key, different request
- 422 STRUCTURED_OUTPUT_INVALID — agent runtime returned invalid output even after repair pass
- 429 RATE_LIMITED
- 500 INTERNAL_ERROR
- 502 UPSTREAM_AGENT_FAILURE — agent runtime call failed; the day did not run; state was rolled back
- 503 SCORING_TEMPORARILY_UNAVAILABLE — scoring subsystem down (we should not silently keep going)

### 2.2 Get day state

```
GET /api/v1/simulations/:simulationId/days/:day
```

**Response (200):**
```typescript
{
  day: number;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  rngStateAfter: string;
  startedAt: string;
  completedAt: string | null;
  createdCounts: { ... };
  errors: Array<{ engine: string, code: string, message: string, ts: string }>;
}
```

## 3. Engines (Phase 1 has only the minimum needed for the vertical slice)

### 3.1 Reality Engine

The vertical slice has a minimal Reality Engine with a small set of event types. The full engine is Phase 1.5.

**Event types in the vertical slice:**
- `SUPPLIER_DELAY`
- `WEATHER_FLOOD`
- `POWER_OUTAGE`
- `SECURITY_INCIDENT`
- `BUDGET_REDUCTION`
- `POLICY_CHANGE`
- `AI_RECOMMENDATION`
- `DECISION_FINALIZED`
- `TASK_COMPLETED`
- `RISK_MATERIALIZED`
- `RISK_RESOLVED`

**Endpoints:**
- `POST /api/v1/simulations/:simulationId/engines/reality/inject` — inject one event manually (used by the day-run)
- `GET /api/v1/simulations/:simulationId/timeline-events` — list events

### 3.2 Decision Engine

**Endpoints:**
- `POST /api/v1/simulations/:simulationId/decisions` — create a decision in response to a timeline event
- `GET /api/v1/simulations/:simulationId/decisions` — list decisions

**Create request body:**
```typescript
{
  triggerEventId?: string;                 // optional: the TimelineEvent that triggered this
  category: 'STRATEGIC' | 'OPERATIONAL' | 'EMERGENCY' | 'FINANCIAL' | 'COMPLIANCE' | 'STAKEHOLDER' | 'CUSTOM';
  title: string;
  description?: string;
  expectedOutcome?: string;
  confidenceEstimate?: number;             // 0..100
  evidenceRefs?: Array<{
    entityType: string;
    entityId: string;
    version?: number;
    retrievedAt: string;                   // ISO 8601
    verificationStatus: 'VERIFIED' | 'UNVERIFIED' | 'CONTESTED';
  }>;
}
```

**Response (201):** the full `ProjectDecision` with `simulationId` set.

### 3.3 Debate Engine

**Endpoints:**
- `POST /api/v1/simulations/:simulationId/decisions/:decisionId/debate` — start a debate thread
- `POST /api/v1/simulations/:simulationId/debates/:threadId/messages` — post a debate message (via agent runtime)
- `POST /api/v1/simulations/:simulationId/debates/:threadId/conclude` — mark the debate as consensus/escalation

**Debate message envelope:**
```typescript
{
  kind: 'debate_round';
  round: number;                           // 1..3
  position: 'SUPPORT' | 'OPPOSE' | 'ABSTAIN';
  argument: string;
  evidenceRefs: Array<{ entityType: string; entityId: string }>;
  confidence: number;                      // 0..1
}
```

### 3.4 Devil's Advocate Engine

**Endpoints:**
- `POST /api/v1/simulations/:simulationId/decisions/:decisionId/devil-advocate` — start a Devil's Advocate challenge
- `POST /api/v1/simulations/:simulationId/challenges/:threadId/messages` — post a challenge message

**Challenge message envelope:**
```typescript
{
  kind: 'devil_advocate';
  area: 'ASSUMPTIONS' | 'RISKS' | 'UNINTENDED' | 'ALTERNATIVES' | 'ETHICS' | 'TIMELINE';
  challenge: string;
  evidenceRefs?: Array<{ entityType: string; entityId: string }>;
  alternativeSuggestion?: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
```

### 3.5 Approval Engine

**Endpoints:**
- `POST /api/v1/simulations/:simulationId/decisions/:decisionId/approval` — create the approval request
- `POST /api/v1/simulations/:simulationId/approvals/:approvalId/approve` — approve (real user action)
- `POST /api/v1/simulations/:simulationId/approvals/:approvalId/reject` — reject

**Approval creation body:**
```typescript
{
  requiredRole: 'OWNER' | 'ADMIN' | 'AUDITOR';
  title: string;
  description?: string;
  expiresAt?: string;
}
```

### 3.6 Task Engine

**Endpoints:**
- `POST /api/v1/simulations/:simulationId/decisions/:decisionId/tasks` — create a task
- `POST /api/v1/simulations/:simulationId/tasks/:taskId/complete` — mark complete (real user or agent)

**Task creation body:**
```typescript
{
  title: string;
  description?: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assigneeAgentId?: string;
  dueAt?: string;
}
```

### 3.7 Auditor Engine (the closing auditor of the slice)

**Endpoints:**
- `POST /api/v1/simulations/:simulationId/decisions/:decisionId/auditor-review` — start an auditor challenge thread
- `POST /api/v1/simulations/:simulationId/audits/:threadId/conclude` — record adequacy and respond

**Auditor message envelope:**
```typescript
{
  kind: 'auditor_challenge';
  question: string;
  expectedEvidenceTypes: string[];          // e.g. ['TimelineEvent', 'KnowledgeEntry']
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
```

### 3.8 Agent Runtime invocation

The framework must call real agents via the existing agent runtime, not by hardcoded templates. The runtime endpoint the framework uses is:

```
POST /api/v1/agents/:agentId/invocations
```

**Request:**
```typescript
{
  task: string;                            // the prompt
  structuredOutputSchema: {
    name: string;
    schema: object;                        // JSON Schema describing the expected response
    strict: true;
  };
  contextRefs?: Array<{ entityType: string; entityId: string }>;
  metadata?: { simulationId: string, day: number, engine: string };
}
```

**Response (200):**
```typescript
{
  invocationId: string;
  provider: string;                        // 'openai' | 'anthropic' | etc.
  model: string;
  promptVersion: string;
  output: object;                          // must validate against structuredOutputSchema
  toolCalls?: Array<{ name: string, args: object, result: object }>;
  tokenUsage: { input: number, output: number, total: number };
  latencyMs: number;
  traceId: string;
}
```

**Error codes:**
- 422 STRUCTURED_OUTPUT_INVALID — the LLM returned JSON that did not validate against the schema
- 502 UPSTREAM_AGENT_FAILURE — the LLM provider failed
- 504 AGENT_TIMEOUT

The framework rejects 422 and 504 with an error in the day-run response. The day is not considered complete; the engine records the failure and the next call to day-run must supply a corrected input (or the user must reset the seed).

## 4. Scoring

The final score has two independent sections. An "excellent organization" running on an unstable platform is correctly flagged.

### 4.1 Compute running scores

```
GET /api/v1/simulations/:simulationId/scores
```

**Response (200):**
```typescript
{
  scoringVersion: 'v1';
  computedAt: string;
  simulationId: string;
  simulationRunId: string;
  versions: { ... };                     // the version block

  organizationalIntelligence: {
    decisionQuality:        { score: number, weight: 0.18, evidence: { decisionsScored: number, decisionsTotal: number } };
    evidenceQuality:        { score: number, weight: 0.13, evidence: { verifiedEvidenceRefs: number, totalEvidenceRefs: number } };
    aiCollaboration:        { score: number, weight: 0.13, evidence: { debatesConcluded: number, decisionsDebated: number } };
    adaptability:            { score: number, weight: 0.13, evidence: { cascadesDetected: number, cascadesTotal: number } };
    longTermPlanning:        { score: number, weight: 0.09, evidence: { learningUpdates: number, decisionsCount: number } };
    governance:              { score: number, weight: 0.09, evidence: { ethicsDecisionsLogged: number, approvalsRouted: number } };
    workflowExecution:       { score: number, weight: 0.05, evidence: { tasksCompleted: number, tasksCreated: number } };
    security:                { score: number, weight: 0.05, evidence: { securityEventsHandled: number, securityEventsTotal: number } };
    performance:             { score: number, weight: 0.03, evidence: { decisionsPerDay: number, decisionsMedianLatencyMs: number } };
    costEfficiency:          { score: number, weight: 0.02, evidence: { budgetSpent: number, budgetTotal: number } };
    predictionAccuracy:      { score: number, weight: 0.10, evidence: { predictionsRealized: number, predictionsTotal: number, meanCalibrationError: number } };
    overall: number;
    grade: string;
    verdict: string;
  };

  platformHealth: {
    apiLatency:     { p50Ms: number, p95Ms: number, maxMs: number, score: number, weight: 0.15 };
    queueLatency:   { p50Ms: number, p95Ms: number, maxMs: number, score: number, weight: 0.10 };
    redisHealth:    { uptimePct: number, p95LatencyMs: number, score: number, weight: 0.10 };
    dbHealth:       { uptimePct: number, p95LatencyMs: number, score: number, weight: 0.20 };
    memoryHealth:   { usedPct: number, p95LatencyMs: number, score: number, weight: 0.05 };
    llmHealth:      { successRatePct: number, p95LatencyMs: number, repairPassSuccessRate: number, score: number, weight: 0.25 };
    retries:        { count: number, score: number, weight: 0.05 };
    failures:       { count: number, p99RecoveryTimeMs: number, score: number, weight: 0.10 };
    overall: number;
    grade: string;
    verdict: string;
  };

  timing: {                                // recorded as a TIMING_METRICS KnowledgeEntry at the end of each day
    timeToDecision:     { p50Ms: number, p95Ms: number, maxMs: number };
    timeToApproval:     { p50Ms: number, p95Ms: number, maxMs: number };
    timeToResolution:   { p50Ms: number, p95Ms: number, maxMs: number };
  };

  productionReady: boolean;               // true only if BOTH organizationalIntelligence.overall >= 75 AND platformHealth.overall >= 75
}
```

**Category weight totals (revised in revision 10):**

| Organizational Intelligence | Weight |
|---|---|
| decisionQuality | 0.18 |
| evidenceQuality | 0.13 |
| aiCollaboration | 0.13 |
| adaptability | 0.13 |
| longTermPlanning | 0.09 |
| governance | 0.09 |
| workflowExecution | 0.05 |
| security | 0.05 |
| performance | 0.03 |
| costEfficiency | 0.02 |
| **predictionAccuracy** | **0.10** |
| **Total** | **1.00** |

**Why `predictionAccuracy` is the second-largest weight:** it is the strongest signal of whether the AI is right about what it says. A high `decisionQuality` with a low `predictionAccuracy` means the AI is making confident decisions that turn out wrong — exactly the failure mode Simulation-5 is designed to expose.

**`predictionAccuracy` computation:**
- For each `ProjectDecision` with a non-null `confidenceEstimate` (0–100) and a non-null `actualOutcomeConfidence` (0–100) recorded on a linked `KnowledgeEntry` of type `PREDICTION_REALIZATION`, the per-decision score is `1.0 - |confidenceEstimate - actualOutcomeConfidence| / 100`.
- The category score is the average across all such decisions.
- `meanCalibrationError` is the average `|confidenceEstimate - actualOutcomeConfidence| / 100` across the same set. It is the Brier-style calibration error.
- If no decisions have both fields set, the category score is `null` and the overall score is computed by renormalizing the weights of the non-null categories. The response includes `partialScore: true` so the consumer knows.

**Platform health data sources:**
- `apiLatency`, `dbHealth`, `redisHealth`, `memoryHealth`, `llmHealth`, `failures`, `retries` come from the existing observability stack (Prometheus, Grafana, the audit log).
- `queueLatency` is read from the queue service.
- The framework does not duplicate the instrumentation. It reads the metrics via existing APIs.

**Timing metrics:**
- `timeToDecision`: `ProjectDecision.createdAt - TimelineEvent.occurredAt` (event → decision)
- `timeToApproval`: `ApprovalRequest.approvedAt - ProjectDecision.createdAt` (decision → approval)
- `timeToResolution`: `Task.completedAt - ApprovalRequest.approvedAt` (approval → completion)
- p50, p95, max are computed from the persisted timestamps over the rolling window (last 7 days by default; configurable).
- These are also written to a `KnowledgeEntry` of type `TIMING_METRICS` on each day-end.

### 4.2 Final scoring

Same as above, plus the call to `POST /simulations/:id/finalize` finalizes the score in a `DecisionEvaluation` row (per decision) and in a `KnowledgeEntry` (type `FINAL_SCORES`) for the run-level score. The run status is set to `COMPLETED`. The `productionReady` flag is the AND of both section thresholds.

## 5. ServiceIdentity management (new in revision 1)

A `ServiceIdentity` is a workload (a simulation engine, a webhook dispatcher, a scheduled job, an external integration). It is **not** a `User`.

### 5.1 Create a service identity

```
POST /api/v1/service-identities
```

**Request body:**
```typescript
{
  name: string;                            // e.g. "simulation-5-engine-001"
  description?: string;
  scopes: string[];                        // e.g. ['simulation-engine']
}
```

**Response (201):**
```typescript
{
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  scopes: string[];
  enabled: boolean;
  createdAt: string;
}
```

**Error codes:**
- 400 INVALID_REQUEST
- 403 PERMISSION_DENIED — caller is not OWNER/ADMIN
- 409 SERVICE_IDENTITY_NAME_TAKEN — same `name` for the same tenant

### 5.2 Issue a service token

```
POST /api/v1/service-identities/:id/tokens
```

**Request body:**
```typescript
{
  ttlSeconds: number;                      // default 3600, max 86400
}
```

**Response (201):**
```typescript
{
  tokenId: string;                          // the ServiceToken id (for audit)
  token: string;                            // the plaintext token, returned ONCE
  scopes: string[];
  expiresAt: string;
}
```

**Notes:**
- The plaintext token is returned **only** here. The server stores only the SHA-256 hash.
- The simulation framework stores the token in a secure in-memory store. It is never logged, never returned to a UI, never persisted in plaintext.

### 5.3 List service identities

```
GET /api/v1/service-identities
```

**Response (200):**
```typescript
{
  items: Array<{
    id: string; name: string; description: string | null; scopes: string[]; enabled: boolean;
    createdAt: string; lastUsedAt: string | null; revokedAt: string | null;
  }>;
}
```

### 5.4 Revoke a service identity

```
POST /api/v1/service-identities/:id/revoke
```

Revokes the identity. Existing tokens expire normally; no new tokens can be issued.

**Response (200):**
```typescript
{
  id: string;
  revokedAt: string;
}
```

### 5.5 Service identity authentication

Every state-changing endpoint the framework calls is invoked with a service token:

```
Authorization: Bearer <service-token>
```

A new `ServiceIdentityGuard` verifies the token: hash match, not revoked, not expired, requested scope is in the token's `scopes`. The `RolesGuard` is bypassed for service-identity calls. The `ActivityEvent` records the call with `actorType: 'SERVICE_IDENTITY'`.

## 6. Structured-output repair pass (new in revision 6)

The agent runtime endpoint (`POST /api/v1/agents/:agentId/invocations`) supports structured output with a repair pass before failing.

**Request (extended):**
```typescript
{
  task: string;
  structuredOutputSchema: {
    name: string;
    schema: object;                        // JSON Schema
    strict: true;
  };
  contextRefs?: Array<{ entityType: string; entityId: string }>;
  metadata?: { simulationId: string, day: number, engine: string };
  repair?: {
    enabled: boolean;                      // default true
    maxAttempts: number;                    // default 2
    maxCumulativeTokens: number;            // default 4× expected budget
  };
}
```

**Server flow:**

```
LLM call (attempt 1)
   ↓
Parse JSON
   ↓ if parse fails
Repair pass 1: "Your previous response was not valid JSON. Return only valid JSON. Do not include commentary."
   ↓ parse again
Schema validation (against structuredOutputSchema)
   ↓ if validation fails
Repair pass 2: "Your previous response did not match the requested schema. Schema: {...}. Your response: {...}. Return only valid JSON matching the schema. Do not include commentary."
   ↓ parse again
Schema validation
   ↓ if still invalid
Return 422 STRUCTURED_OUTPUT_INVALID
```

Each repair attempt is a separate `HermesMessage` linked to the original invocation. The audit log shows the full attempt trail: prompt → response → repair prompt → repair response → outcome. Each attempt is recorded with its own `provider`, `model`, `tokenUsage`, `latencyMs`, `traceId`.

**The repair pass is deterministic** for a given `(prompt, model, modelVersion, temperature)`. This matters for the vertical slice's reproducibility check.

**Response (success):**
```typescript
{
  invocationId: string;
  provider: string;
  model: string;
  modelVersion: string;
  promptVersion: string;
  output: object;                          // validated against structuredOutputSchema
  attempts: Array<{
    attempt: number;
    parsed: boolean;
    schemaValid: boolean;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    latencyMs: number;
  }>;
  tokenUsage: { input: number, output: number, total: number };
  totalLatencyMs: number;
  traceId: string;
}
```

**Error codes:**
- 422 STRUCTURED_OUTPUT_INVALID — all repair attempts failed
- 422 STRUCTURED_OUTPUT_TOKEN_BUDGET_EXCEEDED — cumulative tokens exceeded `maxCumulativeTokens`
- 502 UPSTREAM_AGENT_FAILURE — the LLM provider failed
- 504 AGENT_TIMEOUT

The framework treats 422 and 504 as day-run failures. The day is rolled back if validation fails. The next call to day-run must supply a corrected input (or the user must reset the seed).

## 7. Audit and inspection

### 7.1 List all records created during a simulation

```
GET /api/v1/simulations/:simulationId/records
```

Supports `?entityType=`, `?limit=`, `?cursor=`. Returns a unified stream of all simulation-tagged records (decisions, threads, events, etc.) ordered by `createdAt`. Useful for the simulation overview drawer.

### 7.2 Cross-tenant attempt

All endpoints above are tenant-scoped. A request from tenant A for a `simulationId` belonging to tenant B returns 404 (not 403) so the existence of the simulation is not leaked.

## 8. Idempotency (headers and response shape)

Every state-changing endpoint accepts an `Idempotency-Key` header. The server returns the original response on replay with:

- HTTP status: the same as the original
- Response header `Idempotency-Replayed: true`
- Response header `Idempotency-Original-At: <iso timestamp>`
- Response body has `replayed: true` at the top level for client convenience

If the same key is used with a different request body, the server returns 422 with `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.

The `IdempotencyRecord` table now has the lifecycle fields (see `03-timeline-event-schema.md` §5): `startedAt`, `completedAt`, `attemptCount`, `responseChecksum`, `lastErrorCode`, `lastErrorMessage`. The `responseChecksum` is verified on every replay; a mismatch returns 500 `RESPONSE_CORRUPTED`.

## 9. Error envelope

All errors use the existing `ApiResponse` envelope:

```typescript
{
  status: 'error';
  error: {
    code: string;                          // machine-readable
    message: string;                       // human-readable
    details?: object;                      // optional structured detail
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}
```

The error codes are listed in the per-endpoint sections above. New error codes introduced in this revision:
- `400 INVALID_SIMULATION_ID`
- `409 VERSION_MISMATCH` — request's `expectedVersions` does not match the run's stored versions
- `409 SERVICE_IDENTITY_NAME_TAKEN`
- `403 SERVICE_IDENTITY_SCOPE_INSUFFICIENT`
- `422 STRUCTURED_OUTPUT_INVALID`
- `422 STRUCTURED_OUTPUT_TOKEN_BUDGET_EXCEEDED`
- `500 RESPONSE_CORRUPTED` — `responseChecksum` mismatch on replay
