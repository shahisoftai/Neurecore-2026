# NeuroCore Enterprise Simulation — RUN A Baseline Execution Log

**Date:** 2026-07-13 00:45–01:00 PKT
**Executor:** Kilo (browser automation via Playwright)
**Tenant:** Piracha Associates (`11b2bae6-3c3e-4000-9cf2-d0083c3ccb47`)
**Protocol:** NeuroCore_Enterprise_Verification_Protocol_v2.md
**Standard:** RUN A — test the system as found; record failures before remediation

---

## Executive Summary

RUN A baseline confirms that NeuroCore has solid CRUD and configuration capabilities but falls short on the behavioral requirements of the verification protocol. The primary enterprise chain (Section B) broke at multiple points. AI-to-AI collaboration, EIE behavioral validation, Google Workspace operational use, and organizational memory recall could not be demonstrated. The platform functions as an enterprise data management system but not yet as an AI-native enterprise operating system where AI Employees perform governed organizational work.

---

## Phase 0 — Environment Audit

### Production Health

| Service | URL | Status | Port |
|---|---|---|---|
| Backend (NestJS) | brain.neurecore.com/api/v1/health | ✅ 200 | 3003 |
| Tenant (Next.js) | hq.neurecore.com | ✅ 200 | 3001 |
| Admin (Next.js) | cc.neurecore.com | ✅ 200 | 3020 |

### PM2 Processes

| Process | ID | Status |
|---|---|---|
| neurecore-backend | 4 | ✅ online |
| neurecore-tenant | 1 | ✅ online |
| neurecore-admin | 2 | ✅ online |
| neurecore-cors-proxy | 3 | ✅ online |

### Admin Portal — All Routes Accessible

- **Tenants:** 14 total, including Piracha Associates (TRIAL)
- **6 Pools:** AI Employees (706 templates), Departments (57 templates), Industries (16 majors), Tiers (4), Features (19), Packages (83)
- **Sidebar:** All 19 routes render

### Tenant Portal — Piracha Associates

- **Login:** ✅ owner@pirachaassociates.my / Mali-Test-2026!
- **Home page:** ✅ 3-column glassmorphic layout with hero, KPIs, widgets
- **Navigation:** Home, Departments (8 routes), Marketplace, Service Desk, Finance, Settings
- **Projects:** 4 projects — 3 in LEAD, 1 transitioned to PROPOSAL_SENT during test
- **Customers:** 4 — Acme Corp, GlobalTech, FinanceHub Ltd, Healthcare Plus
- **Finance:** ✅ Page loads, shows $0.00 MTD cost, 0 records, 0 budgets
- **Settings/Integrations:** Google Workspace "Not Connected"

---

## Phase 1 — Mock Enterprise Creation (Pre-existing)

| Field | Value |
|---|---|
| Name | Piracha Associates |
| Industry | financial-services |
| Plan | Enterprise |
| Status | TRIAL |
| Agent Limit | 200 |

**Status:** ✅ PASS — Tenant entity created and persists.

---

## Phase 2 — Departments and Workforce (Pre-existing)

### AI Agents Deployed: 100+ total across multiple deploy sessions

Notable agents specific to Piracha simulation:
- Hermes-Sales (FUNCTIONAL, MiniMax-M2.7-highspeed, IDLE)
- Hermes-Compliance (FUNCTIONAL, MiniMax-M2.7-highspeed, IDLE)
- Hermes-Operations (FUNCTIONAL, MiniMax-M2.7-highspeed, IDLE)
- Hermes-Marketing (FUNCTIONAL, MiniMax-M2.7-highspeed, IDLE)
- Hermes-Executive (EXECUTIVE, MiniMax-M2.7-highspeed, IDLE)
- Sales Outreach Agent (EXECUTIVE, gpt-4o-mini, IDLE)
- Chief Financial Officer (EXECUTIVE, gpt-4o-mini, IDLE)
- Legal Compliance Checker (CORE, gpt-4o-mini, IDLE)
- Finance Tracker (FUNCTIONAL, gpt-4o-mini, RUNNING)
- Plus ~90+ accounting/operations agents, mostly RUNNING

**Status:** ✅ PASS — AI Employee records exist with roles, departments, models. MANY agents show RUNNING status, indicating active background work. However, no AI Employee behaviour could be observed through the browser UI — this is entity existence, not behavioural proof.

---

## Phase 3 — Google Workspace Integration

| Check | Result |
|---|---|
| OAuth configuration exists | ✅ Verified (backend .env has GOOGLE_CLIENT_ID/SECRET) |
| Google Workspace connected for Piracha Associates | ❌ "Not Connected" in tenant settings |
| Gmail integration used in workflow | ❌ Not tested — not connected |
| Google Docs/Sheets/Slides used in project | ❌ Not tested — not connected |
| Drive/Calendar integrated | ❌ Not tested — not connected |

**Status:** BLOCKED / NOT OPERATIONALLY VERIFIED. Google Workspace integration module exists and OAuth is configured, but Piracha Associates tenant has not connected Google. No operational Google Workspace workflow could be demonstrated.

**Evidence:**
- Route: `https://hq.neurecore.com/settings/integrations`
- Expected: Connected Google Workspace with operational tools
- Actual: "Not Connected" status with "Connect Google" button

---

## Phase 4 — Enterprise Communications

| Check | Result |
|---|---|
| Service Desk page loads | ✅ Page accessible at /service-desk |
| Comm feature flags enabled | ✅ COMM_* flags are set in backend .env |
| Threads tab visible | ✅ Threads tab at /service-desk?tab=threads |
| Human-to-AI communication | ❌ Not demonstrable — threads require participants that need IDs |
| AI-to-AI communication | ❌ NOT TESTED — release-critical, could not execute |
| Activity feed | ✅ Live feed widget shows agent activity |

**Status:** UNPROVEN. Infrastructure for communications exists but organizational communication behaviour involving AI Employees could not be demonstrated through the browser UI. The mandatory AI-to-AI collaboration test (Section D) could not be executed.

**Evidence:**
- Console: Socket.IO 400 errors persist (D22 gap)
- No AI agents showed awareness of project context or work requests

---

## Phase 5 — Customer Opportunity Scenario

### Customers Created (Pre-existing)

| Customer | Industry | Status |
|---|---|---|
| Acme Corporation | Manufacturing | ACTIVE |
| GlobalTech Industries | Technology | ACTIVE |
| FinanceHub Ltd | Financial Services | ACTIVE |
| Healthcare Plus | Healthcare | ACTIVE |

**Status:** ✅ PASS — Customers can be created, listed, and viewed.

However, the protocol requires:
- Customer communication via email → ❌ BLOCKED (Google Workspace not connected)
- Sales AI identifies opportunity → ❌ UNPROVEN
- Cross-department communication around opportunity → ❌ UNPROVEN

---

## Phase 6 — Project Creation from Project Type + EIE

### Project Created: FinanceHub Tax Advisory Q3

| Field | Value |
|---|---|
| Name | FinanceHub Tax Advisory Q3 |
| Customer | FinanceHub Ltd |
| Project Type | Wealth Management Account (CLIENT_ENGAGEMENT) |
| Budget | Fixed Fee, $75,000 USD |
| Status | PROPOSAL_SENT (advanced from LEAD) |

### EIE Behavioural Test Results

| Protocol Requirement | Result | Evidence |
|---|---|---|
| Project Type consumes EIE (not owning own logic) | ❌ FAIL | 10 financial-services types shown in dropdown |
| Linked Question Packs resolve | ❌ FAIL | "No questions required for this project" |
| appliesWhen changes question applicability | ❌ NOT TESTED | No questions loaded |
| Adaptive questioning | ❌ NOT TESTED | No questions loaded |
| Manual input → attributable response | ❌ NOT TESTED | Discovery skipped |
| Hermes interview → attributable response | ❌ NOT TESTED | Discovery skipped |
| Document extraction → attributable response | ❌ NOT TESTED | No file upload in discovery |
| Information Source provenance | ❌ NOT TESTED | No sources created |
| Completeness changes with information | ❌ FAIL | Completeness showed 0/0 · 0% — no requirements detected |

**Critical Evidence (Console):**
```
GET /api/v1/projects/cmri7l88m000c8pqzrtuy1ist/information-requirements → 404 Not Found
GET /api/v1/projects/cmri7l88m000c8pqzrtuy1ist/next-question → 404 Not Found
```

**Status:** BLOCKED. The EIE core endpoints (`information-requirements`, `next-question`) return 404. Question Pack resolution does not produce questions for any of the 10 project types. The 3-step wizard (Essentials → Discovery → Review) bypasses Discovery entirely when no questions are resolved. The EIE is NOT functioning as an adaptive, multi-source information acquisition engine.

**Classification:** INTEGRATION GAP — Project types exist, question packs exist (seeded separately), but the link between them is broken or the EIE resolution middleware is not routing correctly.

---

## Phase 7 — Project Execution

### What Worked

| Action | Result |
|---|---|
| Project creation via 3-step wizard | ✅ Project persisted with correct customer, budget, type |
| Status transition (LEAD → PROPOSAL_SENT) | ✅ Transition successful via UI dialog |
| Pipeline view | ✅ Kanban columns show correct counts and project cards |
| Stage management modal | ✅ Shows 3 default stages (Plan, Execute, Close) |

### What Failed

| Action | Result |
|---|---|
| Add team member (human) | ❌ Requires internal actor ID in textbox — no search/select |
| Add team member (AI agent) | ❌ Same issue — requires manual ID entry |
| Advance stage (NOT_STARTED → IN_PROGRESS) | ❌ No UI control for stage transitions found |
| Create deliverable | ❌ No create deliverable UI exposed on project page |
| Create goal | ❌ Not tested — no integration with project view |
| Submit work for approval | ❌ NOT TESTED — no approval trigger UI |
| AI employee assigned project work | ❌ UNPROVEN — no mechanism to assign work to AI via UI |

**Status:** UNPROVEN — Basic project lifecycle (create, view, status transition) works. Advanced lifecycle (team assignment, stage advancement, deliverables, approvals, AI work assignment) could not be demonstrated through the browser UI.

---

## Phase 8 — Finance

| Check | Result |
|---|---|
| Finance page loads | ✅ /finance renders with tabs |
| Cost overview shows data | ✅ Shows $0.00 — no costs incurred |
| Invoices tab accessible | ✅ UI renders |
| Expenses tab accessible | ✅ UI renders |
| Budgets tab accessible | ✅ UI renders |
| Project budget tracking | ❌ NOT TESTED — no integration between finance and project views |
| Finance AI Employee involvement | ❌ UNPROVEN — no observable financial workflow |

**Status:** UNPROVEN — Finance UI exists but no financial activity (invoices, expenses, budget tracking) was recorded for the simulation. The mandatory financial exception test could not be executed.

---

## Summary of Pre-existing Console Errors

| Error | Frequency | Severity |
|---|---|---|
| Socket.IO 400 errors | Every page load | MEDIUM — real-time features silently broken |
| 401 on /auth/me and /tenants/me/current | On first load after login | LOW — handled gracefully by auth system |
| 404 on EIE endpoints (/information-requirements, /next-question) | On project detail page | CRITICAL — blocks entire EIE flow |

---

## Primary Enterprise Chain Trace (Section B)

The mandatory end-to-end enterprise chain was attempted and broke at:

1. ✅ A real inbound customer communication → **BLOCKED** (Google Workspace not connected)
2. ✅ Organizational recognition of customer → **PARTIAL** (customer exists but no context carried from "email")
3. ❌ Sales AI Employee aware of work → **BLOCKED** (no customer communication trigger)
4. ❌ AI Employee performs reasoning → **UNPROVEN**
5. ❌ AI Employee communicates with another department → **UNPROVEN**
6. ❌ Google Workspace artifact created → **BLOCKED**
7. ✅ Project Type selected through browser UI → **PASS** (dropdown with 10 types)
8. ✅ Project created through 3-step wizard → **PASS** (name, customer, budget, type assigned)
9. ❌ EIE Question Packs exercised → **BLOCKED** (404 on EIE endpoints)
10. ❌ Information acquired from 3 sources → **BLOCKED** (Discovery skipped)
11-29: ❌ All downstream items **BLOCKED** by earlier break points

**Chain Integrity:** The primary enterprise chain broke at step 1 (Google Workspace) and step 9 (EIE). No complete end-to-end workflow was achieved.

---

## Final RUN A Status

The simulation baseline reveals:

| Category | Status |
|---|---|
| Enterprise entities (tenants, customers, projects, AI agents) | ✅ PASS |
| Project creation from Project Type via browser | ✅ PASS (essentials only) |
| Status transitions | ✅ PASS |
| EIE — multi-source information acquisition | ❌ BLOCKED (404 on core endpoints) |
| AI-to-AI collaboration | ❌ UNPROVEN |
| Human-AI collaboration | ❌ UNPROVEN |
| Google Workspace operational workflow | ❌ BLOCKED (not connected) |
| Approval lifecycle (rejection → revision → resubmission) | ❌ UNPROVEN |
| Finance operational workflow | ❌ UNPROVEN |
| Organizational memory recall | ❌ UNPROVEN |
| Time and event reactions | ❌ UNPROVEN |
| Continuous Discovery | ❌ BLOCKED (depends on EIE) |

**Verdict:** FOUNDATION ONLY — CORE ENTERPRISE WORKFLOWS NOT PROVEN

The platform demonstrates solid entity management, project creation, and admin tooling. However, the core behavioral requirements — EIE operation, AI Employee collaboration, governed automation, and organizational memory — could not be demonstrated. The system is a capable enterprise data platform but does not yet operate as a coherent AI-native organization.
