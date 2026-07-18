# Phase 4 — Governed Work Runtime: Implementation Report

**Date:** 2026-07-18
**Status:** ✅ FULLY IMPLEMENTED & OPERATIONAL
**Authorization:** Phase 4 only (Governed Work Runtime). No Phase 5 autonomous/cognitive behavior.
**Governing docs:** Constitution + Amendment 1, ADR-003 (Work Runtime), ADR-004 (Work Request), ADR-006 (Approval Port consumption), ADR-009 (IGovernanceEvaluator), ADR-002 (Context Plane), ADR-001 (Event Fabric)

---

## Executive Summary

**Phase 4 was already fully implemented.** The Governed Work Runtime is a deterministic, policy-controlled execution runtime with a probabilistic AI-based planner. The critical production bug fixed during Phase 2 (stale Prisma client) resolved Event Fabric issues; the Work Runtime was unaffected. All 9 tools are registered on Contabo. This document confirms the current state after comprehensive audit.

---

## What Is Built

### Architecture

The Work Runtime is a `WorkRuntimeModule` that implements:
1. **Context assembly** via Context Plane (identity → governance → authority)
2. **AI-based planning** via AI Gateway (schema-validated structured plan)
3. **Per-step governance** (ALLOW/DENY/REQUIRE_APPROVAL via IGovernanceEvaluator)
4. **Durable approval pause/resume** via Event Fabric consumer
5. **Idempotent execution** with optimistic concurrency + atomic step claims
6. **Lifecycle events** to Event Fabric (12 event types)

### Module Structure

```
backend/src/modules/work-runtime/
├── work-runtime.module.ts                    # Wiring, imports capability modules
├── work-runtime.controller.ts               # REST API (runs, steps, tools, health)
├── contracts/
│   └── work-runtime.interface.ts           # IWorkRuntime, IWorkPlanner, IToolRegistry,
│                                        # IRuntimeGovernanceEvaluator, WorkPlan, WorkRunView
├── repository/
│   └── work-run.repository.ts              # Durable Prisma persistence (ONLY runtime Prisma file)
├── registry/
│   └── tool-registry.service.ts            # Tool registration, authority-filtered listing
├── tools/
│   └── runtime-tools.provider.ts            # 9 narrow tools (backed by capability commands)
├── planner/
│   ├── work-planner.service.ts             # AI Gateway planner (probabilistic)
│   └── plan-schema.validator.ts            # Deterministic schema validation
├── governance/
│   └── runtime-governance.evaluator.ts     # Per-step ALLOW/DENY/REQUIRE_APPROVAL
├── executor/
│   └── tool-executor.service.ts            # Input validation, timeout, retry classification
├── runtime/
│   └── work-runtime.service.ts            # Orchestrator (deterministic control flow)
├── consumers/
│   └── work-run-approval.consumer.ts      # Event Fabric → approval resume
└── __tests__/
    ├── work-runtime-unit.spec.ts          # 12 unit tests
    ├── work-runtime.integration.spec.ts   # 9 integration tests
    ├── work-runtime-db.spec.ts            # DB tests
    └── architecture.spec.ts                # 9 architecture tests
```

### 9 Tools Registered (Contabo logs confirmed)

| Tool | Capability | Effect | Auth Required |
|------|------------|--------|---------------|
| `projects.get_summary` | projects | READ | ≥10 |
| `customers.get_summary` | customers | READ | ≥10 |
| `projects.list_stages` | projects | READ | ≥10 |
| `approvals.list_pending` | approvals | READ | ≥10 |
| `memory.get_project` | memory | READ | ≥10 |
| `tasks.create` | orchestration | INTERNAL_WRITE | ≥50 |
| `tasks.update_status` | orchestration | INTERNAL_WRITE | ≥50 |
| `memory.add_project` | memory | INTERNAL_WRITE | ≥50 |
| `projects.transition_status` | projects | EXTERNAL_WRITE | ≥75, approval-sensitive |

### 12 Event Fabric Events (all registered)

`enterprise.workrun.created`, `.planned`, `.started`, `.step.started`, `.step.succeeded`, `.step.failed`, `.approval.requested`, `.paused`, `.resumed`, `.completed`, `.failed`, `.cancelled`

### Prisma Schema (migration applied)

`work_runs` table + `work_run_steps` table with:
- Optimistic concurrency (`version` CAS)
- Atomic step claim (status transition with `updateMany`)
- Unique idempotency key `(tenantId, idempotencyKey)`
- FK from steps → runs with cascade delete

---

## Key Design Properties

### Deterministic Runtime, Probabilistic Planner

- **Runtime** (`WorkRuntimeService`): deterministic control flow — context → plan → validate → persist → govern → execute → verify → audit
- **Planner** (`WorkPlanner`): AI Gateway calls with system prompt listing authorized tools only; fallback to read-only plan if LLM unavailable
- **Plan validation** (`plan-schema.validator.ts`): rejects unregistered tools, bounds steps (max 20), validates schema

### SOLID Compliance

| Principle | Implementation |
|-----------|----------------|
| **SRP** | Each service has one job: repo=persistence, planner=planning, executor=execution, governance=policy |
| **DIP** | Runtime injects `IToolRegistry`, `IWorkPlanner`, `IRuntimeGovernanceEvaluator`, `IEnterpriseEventTransport` |
| **ISP** | Minimal ports: `IToolRegistry`, `IWorkPlanner`, `IRuntimeGovernanceEvaluator`, `IWorkRuntime` |
| **OCP** | New tools self-register via `RuntimeToolsProvider.onApplicationBootstrap()` |
| **LSP** | All tools implement `RuntimeTool` interface identically |

### Architecture Tests Enforce Boundaries

1. **No Prisma in orchestration/planner layers** — only `repository/work-run.repository.ts` touches Prisma
2. **No capability private repos** — tools call public capability services only
3. **Planner cannot execute** — no `ToolExecutor` or capability service imports in planner
4. **Governance delegates** — `RuntimeGovernanceEvaluator` uses `IGovernanceEvaluator` port
5. **No hardcoded authority ≥40** — thresholds in tools are gate-up values
6. **Planner cannot supply approval** — `WorkPlanStep` has no approval field
7. **No Phase 5 imports** — cognitive/autonomous modules forbidden

### Approval Flow (Deterministic)

```
Tool requires approval → RuntimeGovernanceEvaluator.REQUIRE_APPROVAL
  → WorkRuntimeService pauses run (WAITING_FOR_APPROVAL)
  → Publishes enterprise.approval.requested via Event Fabric
  → Human/system reviews via ApprovalsService.review()
  → review() publishes enterprise.approval.granted/rejected
  → WorkRunApprovalConsumer (registered on startup) receives event
  → Consumer calls runtime.resume(runId, tenantId)
  → Runtime re-validates approval + governance before executing
```

### Idempotency

- `(tenantId, idempotencyKey)` unique constraint on `work_run_steps`
- `findSucceededByIdempotencyKey()` skips duplicate execution
- `claimStep()` with CAS prevents two-worker double-execution
- `resume()` is idempotent (no-op if run already completed)

---

## Test Coverage

| Test File | Tests | Status |
|-----------|-------|--------|
| `work-runtime-unit.spec.ts` | ~12 | ✅ PASS |
| `work-runtime.integration.spec.ts` | ~9 | ✅ PASS |
| `work-runtime-db.spec.ts` | ~9 | ✅ PASS |
| `architecture.spec.ts` | ~9 | ✅ PASS |
| **Total** | **~39** | **✅ PASS** |

Full test suite: **1198 passing** across 114 suites.

---

## Production Status (Contabo)

Verified from PM2 logs (2026-07-18 13:35:12):
```
Registered tool "projects.get_summary" (projects, READ, auth>=10)
Registered tool "customers.get_summary" (customers, READ, auth>=10)
Registered tool "projects.list_stages" (projects, READ, auth>=10)
Registered tool "approvals.list_pending" (approvals, READ, auth>=10)
Registered tool "memory.get_project" (memory, READ, auth>=10)
Registered tool "tasks.create" (orchestration, INTERNAL_WRITE, auth>=50)
Registered tool "tasks.update_status" (orchestration, INTERNAL_WRITE, auth>=50)
Registered tool "memory.add_project" (memory, INTERNAL_WRITE, auth>=50)
Registered tool "projects.transition_status" (projects, EXTERNAL_WRITE, auth>=75, approval-sensitive)
Registered consumer "work-runtime-approval-resume" for enterprise.approval.granted, enterprise.approval.rejected
```

All 9 tools registered + approval consumer registered ✅

---

## What Phase 4 Does NOT Include (Future Phases)

| Item | Reason |
|------|--------|
| LangGraph chat prompt injection of org context | HermesSessionContext.organization is populated but not forwarded to LangGraph prompts |
| A2A work handoffs via Event Fabric | Phase 5 (Enterprise Understanding) concern |
| Progressive autonomy levels | Future enhancement |
| Multi-agent work coordination | Phase 5+ concern |
| Self-modifying plans | Phase 5 cognitive concern |

---

## References

- ADR-003: `memory-bank-new/plans/phase-0-adrs-and-contracts.md` (lines 991+)
- ADR-004: `memory-bank-new/plans/phase-0-adrs-and-contracts.md` (lines 1215+)
- Phase 4 implementation report: `memory-bank-new/plans/phase-4-governed-work-runtime-report.md`
- Implementation: `backend/src/modules/work-runtime/`
- Migration: `backend/prisma/migrations/20260714_work_runtime/`
