# ADR-001: Simulation-5 Architecture — Honest Reuse, Not a Parallel Universe

**Status:** Accepted (subject to Phase 1 acceptance gate)
**Date:** 2026-07-16
**Authors:** Kilo
**Supersedes:** The previous (dishonest) Simulation-5 implementation that produced in-memory JSON and labeled it "evidence."

---

## Context

The plan at `memory-bank-new/plans/simulation-5` describes a 60-day adversarial "AI Board Examination" for NeuroCore. The plan lists 15 deliverables: Decision Ledger, Board Meeting Minutes, AI Debate Log, Devil's Advocate Challenges, Counterfactual Analyses, Hallucination Tests, Hidden Information, Ethics Dilemmas, Failure Cascades, Autonomous Learning, Auditor Reports, Production Readiness Certificate, AI Scorecards, Department Reviews, and Maturity Report.

When this was attempted by treating the runner as a standalone script that generated fake data with `Math.random()` and saved the output as JSON files, the result was:

1. The actual NeuroCore tenant remained empty after the run.
2. The "Decision Ledger", "Board Meetings", and "AI Debates" existed only in local files.
3. The 83/100 score was arithmetic over invented data.
4. Users who logged in saw no operational change.

This is a failure of architecture, not just execution. The plan asks NeuroCore to perform behaviors for which the platform has no domain model.

## Decision

We will not build a parallel simulation database. We will:

1. **Map every simulation-5 concept to an existing, production-useful NeuroCore entity** (Threads, Decisions, Knowledge, MissionFeedItem, Approvals, etc.).
2. **Introduce five new entities** — all legitimate production primitives, none simulation-only:
   - `TimelineEvent` — a first-class event log for things that happen in an organization (supplier delays, security incidents, donor communications, outages, policy changes, AI actions, simulation-injected events). This is a real production concept; the simulation framework merely writes to it.
   - `IdempotencyRecord` — a tenant-scoped replay-protection table for any state-changing operation. Used by simulations but also by agents, integrations, and external API clients.
   - `DecisionEvaluation` — an immutable scores snapshot for a `ProjectDecision`. The decision row stays immutable; scores evolve by appending a new `DecisionEvaluation` row.
   - `ServiceIdentity` — a first-class concept for a workload (simulation engine, webhook dispatcher, scheduled job, external integration, CLI). Not a `User`. Has scopes, audit, and a lifecycle.
   - `ServiceToken` — a short-lived bearer token issued for a `ServiceIdentity`. SHA-256 hashed at rest; plaintext returned once. Scoped, expiring, revocable, tenant-bound.
3. **Represent the simulation run itself as a tagged Project** (not a new table). The Project's metadata holds the seed, current day, engine configuration, scoring version, and a reference to a master control Thread.
4. **Use the real Agent runtime** to produce decision text, debate contributions, and challenge content. No static templates dressed as agent output. Structured output is required and validated; the runtime has a bounded repair pass before failing.
5. **Score deterministically from persisted evidence** using a versioned TypeScript module. The operational AI workforce does not score itself. LLM-based qualitative review is allowed but is never the authoritative numeric score. The score has two independent sections: Organizational Intelligence (about the AI's decisions) and Platform Health (about the runtime's reliability).
6. **Tag every generated record with `simulationId`** (a globally unique URI of the form `sim://YYYY/MM/DD/<org>/<framework>/<seq>`) so production retrieval queries can filter it out by default, and the simulation overview UI can show all of it.

## Consequences

### Positive
- Every simulation artifact is a real NeuroCore record visible in the existing UI.
- The simulation exercises the actual platform end-to-end (tenancy, auth, audit, search, RAG, knowledge graph).
- The new `TimelineEvent`, `IdempotencyRecord`, `DecisionEvaluation`, `ServiceIdentity`, and `ServiceToken` tables are useful long after this exercise; they are not test-only.
- Re-runs of the same day with the same seed **and the same versions** are reproducible. Re-runs with the same idempotency key are no-ops. Reruns with different tenants are isolated.
- The `simulationId` URI is content-addressable and globally unique; a future "simulation registry" service can index runs by URI without coordination.
- Decisions stay immutable; scores are snapshotted on `DecisionEvaluation` rows with versioning. Future scoring versions do not retroactively rewrite historical evaluations.
- The split scorecard (Organizational Intelligence + Platform Health) prevents the failure mode of an excellent organization on an unstable platform appearing "healthy."

### Negative
- The simulation's data shape is constrained by the existing entity fields. We will need to add a small number of optional fields to `ProjectDecision` and `CommunicationThread` via a backward-compatible Prisma migration. These fields are nullable and unused outside simulations, so production code is unaffected.
- The control Thread can accumulate many messages. We will keep it paginated and use a structured message format (typed envelope) instead of freeform prose.
- "Real agent runtime" calls are not free. The vertical slice will perform one agent call per role per day; we must monitor token usage and add budget guards before expanding to all five engines.
- The repair pass adds up to 2 LLM calls per failed structured output. This roughly doubles the worst-case LLM cost per agent call. The token budget cap (`maxCumulativeTokens`) limits the worst case.
- `ServiceIdentity` is a new concept; the team must learn it. But the alternative (mixing service accounts with `User`) created more confusion.

### Risks
- The structured-output requirement is the hardest part. We must design JSON schemas that the configured LLM (and the gateway) actually return. The repair pass reduces but does not eliminate the risk; we still need to use a provider that supports JSON schema enforcement (e.g. OpenAI's `gpt-4-turbo` with `response_format={"type": "json_schema"}`). The vertical slice uses `gpt-4o-mini` with `json_object` mode, which is more permissive but allows the repair pass to do more work.
- Synthetic data leakage into RAG. We must ensure `Knowledge` queries do not return rows whose `simulationId IS NOT NULL` and whose category is synthetic. We will implement a database view or a service-level filter and add a regression test.
- The previous "simulation5-aeic" tenant and its fake JSON evidence remain in the system as invalidated forensic data. We will mark them so future runs do not mistake them for real results.
- The deterministic seed is necessary but not sufficient for true reproducibility. If the LLM provider's model version drifts (e.g. OpenAI updates `gpt-4o-mini`), the same seed produces different outputs. The `versions.modelVersion` field captures this; a version mismatch is an explicit replay-failure mode, not a silent corruption.

### Long-term roadmap note: Organizational Memory

This is **not** in scope for the simulation framework. It is a note for the future.

Today, knowledge, timeline, threads, decisions, and approvals exist as separate primitives. An AI agent that wants to answer "what happened in Q3?" must query five different tables.

The long-term idea is an `OrganizationalMemory` abstraction that sits on top of all of these:

```
Decision      →  Memory
Meeting       →  Memory
Event         →  Memory
Task          →  Memory
Approval      →  Memory
```

A single graph query returns the relevant memory nodes for any prompt. The today's `KnowledgeEntry`, `TimelineEvent`, and `CommunicationThread` tables are the foundation this abstraction would sit on; the work in this slice does not preclude it.

The note is here so the simulation framework's `simulationId` tagging, `relatedEntityType` cross-entity references, and the persistent version block are designed with this in mind.

## Alternatives Considered

### Alternative A: 19 new simulation-only tables (rejected)
Build `DecisionLedgerEntry`, `AIDebate`, `HallucinationChallenge`, etc. as dedicated tables. The user explicitly rejected this. It would create a parallel testing universe, complicate tenant isolation, and never be exercised by real customers.

### Alternative B: Map to Threads only, no schema additions (rejected)
Use only `CommunicationThread` with JSON metadata for everything. This was the first instinct. The user correctly pointed out that a Decision is not a conversation — it has status, owner, approval state, evidence, and review date. A thread records the deliberation, not the commitment. We use `ProjectDecision` for the authoritative decision record and `Thread` for the deliberation.

### Alternative C: Build the full framework first, then iterate (rejected)
Build all five engines, the 15 deliverables, and the full UI in one go. The user rejected this — a vertical slice first is mandatory. A full vertical slice proves the data model, the agent-runtime integration, the scoring rules, and the UI filter approach all work. Only after that is the rest of the engine suite worth building.

## Phase Plan

### Phase 1 (this ADR's scope)
Items 1–8 of the design package (this document through the vertical slice specification), then implementation of the vertical slice and its acceptance gate. The vertical slice is the end-to-end path:

```
Reality Engine injects supplier delay
   → TimelineEvent persisted
   → Decision proposed
   → Debate Thread created
   → Devil's Advocate challenges it
   → Approval requested
   → Decision finalized
   → Task created
   → Outcome event recorded
   → Auditor evaluates evidence
   → Dashboard displays every record
```

### Phase 1.5 (after acceptance)
Expand the engines. Add the remaining 19 event types, the 9 ethics dilemmas, the 4 hallucination tests, the 5 hidden-information tests, the 8 weekly learning updates, the 80 counterfactuals, the 3-round debates, the full 11-category Organizational Intelligence scoring (with `predictionAccuracy` becoming meaningful once outcomes are realized), and the full Platform Health scoring. Reality Engine is **not** finished after the vertical slice — the slice has a minimal Reality Engine; it will be expanded.

When Phase 1.5 starts, the new files written should be committed in thin commits so each engine can be reviewed independently.

### Phase 2 (much later, may never be needed)
Only if commercial demand for a Digital Twin / Scenario Planning product emerges: introduce a first-class `ScenarioRun` entity. The current Project-as-simulation-run representation migrates cleanly because all the data is already there, tagged with `simulationId`.

## Phase 1 Acceptance Gate

The vertical slice passes only when all of the following are true (these are the same conditions the user specified):

1. The injected event is visible in the browser on a real operational page.
2. The linked Decision, Thread, Approval, Task, and outcome TimelineEvent are queryable as real database records.
3. Every generated record carries the same `simulationId`.
4. Rerunning the same day with the same seed produces the same injected event (deterministic).
5. Rerunning the same day with the same idempotency key creates no new records; the second response has `replayed: true` and the same body as the first.
6. A different tenant cannot retrieve any of the records (cross-tenant isolation).
7. The audit log identifies the real actor or engine that produced each record.
8. No evidence is produced in local files only.
9. The numeric score is computed only from persisted, queryable records.
10. A real agent-runtime call occurred and its structured output passed schema validation.
11. Every evidence reference resolves to a persisted, tenant-scoped entity.
12. The browser shows the same records that the API returns.
13. Synthetic claims never appear in normal Knowledge retrieval queries.
14. No direct Prisma mutation is used to "fix" anything during a run; everything goes through the API.

If any of these fail, the vertical slice is not done. We do not begin Phase 1.5.

## Linked Documents

- `02-entity-mapping-audit.md` — the full mapping table from simulation-5 concepts to NeuroCore entities, with field-level detail.
- `03-timeline-event-schema.md` — the `TimelineEvent` and `IdempotencyRecord` schemas.
- `04-simulation-tagging-rules.md` — how `simulationId`, `correlationId`, and related tags are placed and enforced.
- `05-api-contracts.md` — endpoint-by-endpoint request/response shapes.
- `06-authorization-matrix.md` — who can create/read/update each entity, by role.
- `07-idempotency-strategy.md` — key format, storage, TTL, replay semantics.
- `08-vertical-slice-spec.md` — the exact sequence of API calls and persisted records, no code.
- `09-ui-simulation-filters.md` — badges, filter chips, overview drawer contents.
- `10-acceptance-gate-test.md` — the automated integration test that proves the slice works.
