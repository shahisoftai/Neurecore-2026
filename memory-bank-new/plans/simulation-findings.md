# NeuroCore Enterprise Simulation — Findings Register (IMMUTABLE)

**Date:** 2026-07-13 01:00 PKT
**Run:** RUN A — Baseline
**Tenant:** Piracha Associates
**Executor:** Kilo

---

## Finding IDs and Classifications

Gap types per protocol: BUG, INTEGRATION GAP, WORKFLOW GAP, CONSTITUTIONAL VIOLATION, UX GAP, MISSING CAPABILITY, DATA INTEGRITY RISK, SECURITY/TENANT ISOLATION RISK, AI EMPLOYEE BEHAVIOUR GAP, EVENT ARCHITECTURE GAP

---

## FINDING-001 — EIE Endpoints Return 404 (CRITICAL)

**Test IDs:** EIE-001 through EIE-013
**Classification:** INTEGRATION GAP
**Severity:** CRITICAL
**Downstream tests invalidated:** All EIE tests (Section F), Continuous Discovery (Phase 9), Organizational Memory provenance

### Expected Behaviour
`GET /api/v1/projects/:id/information-requirements` should return resolved question packs linked to the project type's capabilities. `GET /api/v1/projects/:id/next-question` should return the next pending question in the adaptive questioning flow.

### Actual Behaviour
Both endpoints return `404 Not Found`. The project creation wizard's Discovery step shows "No questions required for this project" with completeness 0/0.

### Browser Evidence
- Route: `https://hq.neurecore.com/projects/new` (Discovery step)
- UI: "No questions required for this project." — 0/0 · 0% completeness
- Console: `GET .../information-requirements → 404`, `GET .../next-question → 404`

### Suspected Root Cause
The EIE middleware that resolves `GET /projects/:id/information-requirements` may not be registered as a route, or the controller path mapping is incorrect. The frontend calls the endpoint but the backend has no handler for it at this path. Alternatively, the information requirements adapter for projects was never completed.

---

## FINDING-002 — No Question Pack Resolution for Project Types (SEVERE)

**Test IDs:** EIE-002, EIE-004
**Classification:** INTEGRATION GAP
**Severity:** SEVERE
**Downstream tests invalidated:** Adaptive questioning, multi-source acquisition, completeness scoring, supersession, continuous discovery

### Expected Behaviour
Selecting "Wealth Management Account" project type should resolve linked question packs (Core, Customer, Budget, Timeline, Deliverables capability packs) and present questions in the Discovery step.

### Actual Behaviour
All 10 financial-services project types show "No questions required for this project." Question packs are seeded but not linked to project types at runtime. The Discovery step has no content for any project type.

### Suspected Root Cause
The `ProjectType.capabilityPackIds` or equivalent linking mechanism is either empty in the database or the frontend resolver does not correctly traverse the capability → question pack relationship.

---

## FINDING-003 — Team Assignment Requires Manual Actor ID (UX GAP)

**Test IDs:** TEAM-001
**Classification:** UX GAP
**Severity:** MODERATE

### Expected Behaviour
"Manage Team" should provide a searchable/selectable list of employees (human and AI) with roles to assign to the project.

### Actual Behaviour
Modal shows a raw "actor id" textbox requiring manual entry of internal database IDs. No search, no dropdown of available employees, no autocomplete. The "Assign Member" button is disabled until a valid ID is manually typed.

### Browser Evidence
- Route: `https://hq.neurecore.com/projects/cmri7l88m000c8pqzrtuy1ist` → "Manage Team (0)"
- UI: Textbox labeled "actor id" with no helper text

---

## FINDING-004 — No Stage Advancement UI (WORKFLOW GAP)

**Test IDs:** STAGE-001
**Classification:** WORKFLOW GAP
**Severity:** MODERATE

### Expected Behaviour
Project stages (Plan, Execute, Close) should have actionable transitions (NOT_STARTED → IN_PROGRESS → COMPLETED) through the project detail UI.

### Actual Behaviour
Stages display as read-only status labels. No click-to-advance, no inline actions, no stage transition controls visible on the project detail page.

---

## FINDING-005 — No Deliverable/Goal Creation from Project View (WORKFLOW GAP)

**Test IDs:** DELIV-001, GOAL-001
**Classification:** WORKFLOW GAP  
**Severity:** MODERATE

### Expected Behaviour
Project detail page should expose "Add Deliverable", "Add Goal", "Add Memory Entry", "Add Decision" actions.

### Actual Behaviour
Project detail page shows summary only. The action button row has 8 tooltip-only buttons with no visible labels. Deliverable and goal creation requires navigating away from the project context.

---

## FINDING-006 — Google Workspace Not Operationally Connected (BLOCKED)

**Test IDs:** GW-001 through GW-006
**Classification:** INTEGRATION GAP
**Severity:** HIGH
**Downstream tests invalidated:** Gmail workflow, Google Docs proposal, Sheets budget, Slides presentation, Drive storage, Calendar events

### Expected Behaviour
Google Workspace should be connected for Piracha Associates, enabling Gmail, Drive, Docs, Sheets, Slides, and Calendar integrations within enterprise workflows.

### Actual Behaviour
Google Workspace shows "Not Connected" in tenant settings. Integration module exists and OAuth is configured on backend, but the tenant has not completed the OAuth consent flow.

---

## FINDING-007 — No AI-to-AI Communication Observable (AI EMPLOYEE BEHAVIOUR GAP)

**Test IDs:** A2A-001, A2A-002
**Classification:** AI EMPLOYEE BEHAVIOUR GAP
**Severity:** RELEASE-CRITICAL

### Expected Behaviour
Section D mandates two AI-to-AI work chains: Sales AI → Finance AI → Sales AI, and Project AI → Compliance AI → Project AI → Human Approver.

### Actual Behaviour
100+ AI agents are deployed but none showed observable awareness of project work, customer context, or other employees. No mechanism exists in the browser UI to trigger or observe AI-to-AI communication. The comms subsystem is configured (COMM_* flags enabled) but the Threads UI was not functional during testing.

---

## FINDING-008 — Socket.IO Real-time Broken (EVENT ARCHITECTURE GAP)

**Test IDs:** EVENT-001
**Classification:** EVENT ARCHITECTURE GAP
**Severity:** MEDIUM
**Pre-existing:** Yes (D22 in pending-tasks.md)

### Expected Behaviour
Socket.IO should maintain persistent connections for real-time activity feed, approvals push, and presence.

### Actual Behaviour
`GET /socket.io/?EIO=4&transport=polling` returns 400 on every page load. Real-time features silently broken.

---

## FINDING-009 — Finance Not Integrated with Projects (INTEGRATION GAP)

**Test IDs:** FIN-001
**Classification:** INTEGRATION GAP
**Severity:** MODERATE

### Expected Behaviour
Project budget should be reflected in finance records. Finance AI should be aware of project financial activity.

### Actual Behaviour
Finance page shows $0.00 MTD cost with 0 records. Project page shows $75,000 budget but this is isolated — no integration between the two views.

---

## FINDING-010 — No Approval Mechanism in Project Workflow (WORKFLOW GAP)

**Test IDs:** APPR-001 through APPR-005
**Classification:** WORKFLOW GAP
**Severity:** HIGH

### Expected Behaviour
Projects should support approval workflows: AI work → approval request → human review → rejection/revision → resubmission → approval → downstream continuation.

### Actual Behaviour
No approval trigger, request, or chain visible in the project UI. Service Desk → Approvals tab loads but shows "No pending approvals." The approval chain lifecycle could not be exercised.

---

## Summary

| Code | Count |
|---|---|
| INTEGRATION GAP | 4 |
| WORKFLOW GAP | 3 |
| UX GAP | 1 |
| AI EMPLOYEE BEHAVIOUR GAP | 1 |
| EVENT ARCHITECTURE GAP | 1 |

**Immediate blockers to simulation continuation:** FINDING-001, FINDING-006, FINDING-007
