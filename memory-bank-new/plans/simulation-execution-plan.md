# NeuroCore Full Enterprise Simulation — Execution Plan

**Based on:** `plans/full verification` (the master plan)
**Phase 0 Audit completed:** 2026-07-12 22:30 PKT
**Pre-browser execution — plan must be reviewed before proceeding.**

---

## Phase 0 — Environment and Capability Audit (COMPLETE)

### Production Health

| Service | URL | Status | Port |
|---|---|---|---|
| Backend (NestJS) | brain.neurecore.com | ✅ 200 healthy | 3003 |
| Tenant (Next.js) | hq.neurecore.com | ✅ 200 | 3001 |
| Admin (Next.js) | cc.neurecore.com | ✅ 200 | 3020 |
| CORS proxy | — | ✅ online | 3004 |
| Socket.IO | brain + hq | ✅ 200 | — |

### PM2 Processes

| Process | ID | Uptime | Restarts | Status |
|---|---|---|---|---|
| neurecore-backend | 4 | ~2h | 247 | online |
| neurecore-tenant | 1 | ~4h | 9 | online |
| neurecore-admin | 2 | ~20h | 35 | online |
| neurecore-cors-proxy | 3 | ~44h | 0 | online |

### Database
- **48 Prisma migrations** applied, schema up to date
- **Neon PostgreSQL** (pooled: `ep-summer-pond-...`)
- **Redis** on 127.0.0.1:6379

### API Endpoints (all 200 with admin JWT)

| Group | Endpoints |
|---|---|
| Auth | `/auth/me`, `/auth/login`, `/auth/refresh` |
| Platform | `/tenants`, `/users`, `/feature-flags` |
| Pools | `/agents-pool`, `/departments-pool`, `/industries`, `/tier-templates`, `/features`, `/packages` |
| Projects | `/projects`, `/customers`, `/goals`, `/deliverables`, `/project-memory`, `/project-decisions`, `/project-types`, `/approval-chains/pending` |
| Operations | `/agents`, `/departments`, `/finance/expenses`, `/routines` (pre-existing bug), `/health/detailed` |

### Admin Portal (cc.neurecore.com)
- **Login:** ✅ Working (admin@neurecore.ai / NeureCore-Admin-2026!)
- **Sidebar navigation:** All 19 routes render
- **Tenants page:** 13 tenants listed, searchable
- **6 Pools:** AI Employees (706 templates), Departments (57 templates), Industries (16 majors), Tiers (4), Features (19), Packages (83)
- **Strategy Room:** Works
- **Models, Brain Map, Agent Fleet:** Routes accessible
- **⚠️ Auth state persistence:** Client-side navigation works within session; full page reloads redirect to login (known `_hasHydrated` race condition)

### Tenant Portal (hq.neurecore.com)
- **Login:** ✅ Working (mali@live.com / Mali-Test-2026!)
- **Home page:** ✅ Full Creatio-style 3-column layout (hero, KPIs, widgets, glassmorphic)
- **Navigation:** Home, Departments (with 5+ sub-tabs), Marketplace, Service Desk (Inbox/Approvals/Activity), Finance, Settings
- **Key routes (all 200):** /projects, /customers, /marketplace, /service-desk, /finance, /departments, /settings
- **Console:** 3 pre-existing 401 errors on auth/me and tenants/me/current (handled gracefully by error boundaries)

### Critical Fixes Applied During Audit

| Fix | Issue | Resolution |
|---|---|---|
| FIX-041 | JWT `passwordChangedAt` precision bug | Fixed seconds vs milliseconds comparison in JwtStrategy |
| FIX-042 | Admin + tenant accounts locked out | Reset passwords, cleared DB + Redis lockouts |
| FIX-043 | Cross-tenant access broken (3 endpoints) | Applied FIX-010 `'*'` sentinel pattern to controllers |

### Known Gaps (blockers or risks for simulation)

| Gap | Severity | Impact |
|---|---|---|
| Socket.IO 400 errors (D22) | MEDIUM | Real-time features (activity feed push, live approvals, presence) silently broken |
| Routines endpoint 500 (pre-existing `sub`→`in` bug) | LOW | Routines API unusable via browser |
| Admin full-page navigation drops auth | MEDIUM | Known `_hasHydrated` race; navigation via sidebar links works |
| Google OAuth env setup may be incomplete | MEDIUM | Needs verification before Phase 3 |
| Hermes AI Employee runtime gated behind `HERMES_ENABLED` flag | HIGH | Must be enabled per-tenant before AI-to-AI communication tests |
| No pre-existing "Ali Associates" tenant | HIGH | Must create tenant via admin portal or API |
| FEATURE FLAGS all `COMM_*` disabled | HIGH | Enterprise communication features not visible to tenants |

---

## Phase 1 — Mock Enterprise Creation

### 1.1 Tenant: "Ali Associates"

**Identity:**
- Name: Ali Associates
- Industry: Financial Services
- Country: Malaysia
- Size: 50 employees (medium enterprise)
- Business: Wealth management, corporate financial advisory, tax planning

**Creation method:** Admin portal → Tenants → Create Tenant, OR API.
**Required roles:** SUPER_ADMIN (available as admin@neurecore.ai)

### 1.2 Company Data

| Aspect | Details |
|---|---|
| Products | Wealth Management, Corporate Advisory, Tax Planning, Audit Services |
| Customers | 5 mock corporate clients (manufacturing, tech, retail, healthcare, property) |
| Vendors | 3 (IT services, office supplies, compliance software) |
| Active Projects | 2 (Client quarterly review, Digital transformation) |
| Financial structure | 3 revenue streams, 4 cost centers, 1 project budget |
| Compliance | Malaysia Securities Commission, BNM regulations |

### 1.3 Browser Execution Steps

```
Step 1: Open cc.neurecore.com/admin/login
Step 2: Login as admin@neurecore.ai / NeureCore-Admin-2026!
Step 3: Navigate to Tenants → Create Tenant
Step 4: Fill: name="Ali Associates", industry="Financial Services", tier="Professional"
Step 5: Set onboardingCompletedAt to skip wizard
Step 6: Verify tenant appears in tenant list
```

---

## Phase 2 — Departments and Workforce

### 2.1 Departments

| Department | Head | Mandate |
|---|---|---|
| Executive / CEO Office | Ali bin Hassan (CEO) | Strategic direction, governance |
| Operations | Sarah Chen | Service delivery, vendor management |
| Finance | Ahmad Razak | Accounting, treasury, billing |
| Sales | Priya Kumar | Client acquisition, relationship management |
| Marketing | Lisa Wong | Brand, communications, lead generation |
| IT / Technology | Ravi Singh | Infrastructure, security, AI tools |
| Compliance | Farid Omar | Regulatory, risk, audit |
| HR | Nurul Aisyah | People operations, culture |

### 2.2 Hermes AI Employees

| AI Employee | Department | Role | Autonomy Level |
|---|---|---|---|
| Hermes-Finance | Finance | Automated reconciliation, expense monitoring | Medium |
| Hermes-Sales | Sales | Lead scoring, pipeline analysis, proposal drafts | Medium |
| Hermes-Compliance | Compliance | Regulatory change tracking, audit prep | Low (human approval required) |
| Hermes-IT | IT | Ticket triage, system monitoring | Low |
| Hermes-Operations | Operations | Process automation, vendor communication | Medium |

### 2.3 Browser Execution Steps

```
Step 1: Login as mali@live.com (tenant OWNER)
Step 2: Navigate to Departments → Create Departments (8 departments above)
Step 3: Add human employees from admin portal (create via Tenants → Ali Associates → Users)
Step 4: Deploy AI Employees from admin pool (Tenants → Ali Associates → Agents → Deploy)
Step 5: Enable Hermes per-tenant: node scripts/enable-hermes-tenant.cjs <tenantId>
```

---

## Phase 3 — Google Workspace Validation

### 3.1 Prerequisites
- Enable Google Workspace integration for Ali Associates tenant
- Verify `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in backend `.env`
- Verify `GOOGLE_REDIRECT_URI` is set

### 3.2 Test Scenarios

| Scenario | Action | Expected |
|---|---|---|
| Gmail | Receive customer email → route to Sales AI | Context preserved, response drafted |
| Google Docs | Create project proposal doc | Accessible from project records |
| Google Sheets | Create budget tracker | Finance updates sheet |
| Google Drive | Store project files in tenant folder | Proper access boundaries |
| Google Calendar | Schedule meeting with AI Employee | Calendar event created |

### 3.3 Browser Execution Steps

```
Step 1: Login as mali@live.com → Settings → Integrations
Step 2: Connect Google Workspace (mnpiracha@gmail.com / Shahikhail@F005698)
Step 3: Grant Gmail, Drive, Docs, Sheets, Calendar scopes
Step 4: Test each integration inside a real workflow
```

---

## Phase 4 — Communications

### 4.1 Enable Feature Flags
```bash
# On Contabo, flip COMM_* flags for Ali Associates tenant
# This enables threads, activity feed, AI messaging
```

### 4.2 Test Scenarios

| Scenario | Participants | Method |
|---|---|---|
| Human → Human DM | Sarah Chen → Ahmad Razak | Service Desk → Inbox |
| Human → AI | Priya Kumar → Hermes-Sales | Direct message to AI Employee |
| AI → Human | Hermes-Finance → Ahmad Razak | Automated notification on threshold breach |
| AI → AI | Hermes-Sales → Hermes-Operations | Order processing handoff |
| Department → Dept | Sales → Operations | Cross-functional thread |
| Escalation | AI → Manager | Compliance AI escalates to Farid Omar |

### 4.3 Browser Execution Steps

```
Step 1: Login as mali@live.com → Service Desk
Step 2: Send a direct message to another human employee
Step 3: Send a message to Hermes-Sales AI Employee
Step 4: Verify notifications appear
Step 5: Create a department channel / group thread
```

---

## Phase 5 — Customer Opportunity Scenario

### 5.1 Story

A customer email arrives (via Google Gmail integration):
"TechGlobal Manufacturing Berhad" needs a comprehensive financial advisory engagement for their expansion into ASEAN markets. The Sales AI Employee identifies the opportunity, routes to Operations for scoping, and Finance prepares a preliminary budget.

### 5.2 Browser Execution Steps

```
Step 1: Verify customer TechGlobal exists in CRM (create if not)
Step 2: Trigger Gmail integration to receive the customer email
Step 3: Sales AI (Hermes-Sales) identifies the opportunity
Step 4: Sales communicates with Operations (Hermes-Operations)
Step 5: Google Docs proposal is created
Step 6: Finance (Ahmad Razak) prepares budget in Google Sheets
Step 7: Management presentation created in Google Slides
Step 8: Opportunity status moves to proposal stage
```

---

## Phase 6 — Project Creation and EIE

### 6.1 Project Type Selection

Select "Financial Advisory Engagement" project type.
Run Information Acquisition via Enterprise Information Engine.

### 6.2 Browser Execution Steps

```
Step 1: Navigate to Projects → New Project
Step 2: Select Project Type: "Financial Advisory Engagement"
Step 3: Enter essential info (name, description, target date)
Step 4: Invoke Enterprise Information Engine
Step 5: Answer Question Packs (Core, Customer, Budget, Timeline)
Step 6: Leave some questions for Hermes interview
Step 7: Upload a customer document for extraction
Step 8: Review completeness scoring
Step 9: Confirm project creation
Step 10: Verify continuous discovery begins
```

---

## Phase 7 — Project Execution

### 7.1 Stages & Tasks

| Stage | Tasks | Assignee |
|---|---|---|
| Discovery | Customer interviews, data gathering | Sarah Chen + Hermes-Sales |
| Analysis | Financial modeling, risk assessment | Hermes-Finance + Ahmad |
| Proposal | Draft recommendations, budget | Hermes-Sales + Priya |
| Review | Internal review, compliance check | Farid Omar + Hermes-Compliance |
| Presentation | Client presentation, sign-off | Ali bin Hassan + Lisa Wong |

### 7.2 Browser Execution Steps

```
Step 1: Open project → view stages pipeline
Step 2: Assign tasks to human and AI employees
Step 3: Advance a stage (trigger event)
Step 4: Submit a deliverable for approval
Step 5: Hermes-Finance monitors budget
Step 6: Timeline changes trigger event
```

---

## Phase 8 — Finance and Governance

### 8.1 Financial Activity

| Action | Expected |
|---|---|
| Record project expense | Expense appears in project budget |
| Revenue milestone | Revenue tracked against project |
| Budget threshold exceeded | Event emitted, AI notified |
| Financial approval required | Approval workflow triggered |

### 8.2 Approval Scenarios

| Scenario | Authority | Risk Level |
|---|---|---|
| Routine expense < $1000 | AI Employee auto-approve | Low |
| Deliverable acceptance | Sarah Chen (Ops Director) | Medium |
| Budget increase > 20% | Ali bin Hassan (CEO) | High |
| Compliance waiver | Farid Omar + Ali bin Hassan | Critical |

### 8.3 Browser Execution Steps

```
Step 1: Navigate to Finance → record an expense
Step 2: Navigate to project → budget tracking
Step 3: Trigger financial approval from project
Step 4: Verify approval chain works
Step 5: Test rejection flow
```

---

## Phase 9 — Events and Continuous Discovery

### 9.1 Events to Trigger

| Event | Trigger | Expected Reaction |
|---|---|---|
| Project created | Phase 6 | Departments notified, resources allocated |
| Expense threshold exceeded | Phase 8 | Hermes-Finance alerts Ahmad, approval requested |
| Stage completed | Phase 7 | Next stage auto-starts, timeline recalculated |
| Customer email received | Phase 5 | Sales AI reads, updates opportunity |
| Document uploaded | Phase 6 | EIE extracts info, completeness updated |
| Approval granted/rejected | Phase 8 | Downstream workflow continues/stops |

### 9.2 Continuous Discovery

- After project creation, EIE runs weekly discovery
- Hermes interviews the project manager for missing info
- Completeness score should increase over time
- New information updates project requirements

---

## Phase 10 — Memory and Enterprise Intelligence

### 10.1 Memory Tests

| Question | Source of Truth |
|---|---|
| "Why was the project budget increased?" | Decision record in Phase 8 |
| "Who approved the deliverable?" | Approval chain in Phase 7 |
| "What did TechGlobal originally request?" | Customer email in Phase 5 |
| "Which document provided the requirement?" | EIE source provenance in Phase 6 |
| "Why was the timeline changed?" | Timeline event in Phase 7 |

### 10.2 Browser Execution Steps

```
Step 1: Ask Hermes about the budget decision
Step 2: Check project memory for decision records
Step 3: Verify provenance on EIE sources
Step 4: Check timestamps match event order
```

---

## Phase 11 — Project Completion

### 11.1 Completion Steps

| Step | Action | Verification |
|---|---|---|
| Final deliverable | Submit, get approved | Approval chain completed |
| Project closed | Status → COMPLETED | All tasks resolved |
| Financial close | Final budget vs actual | Variance report |
| Lessons learned | Memory entry created | Organizational knowledge retained |
| Customer feedback | Documented | Stored in customer record |

### 11.2 Browser Execution Steps

```
Step 1: Complete all project tasks
Step 2: Submit final deliverable for approval
Step 3: CEO approves → project status → COMPLETED
Step 4: Capture lessons learned in project memory
Step 5: Archive project
Step 6: Ask Hermes about project history to verify memory
```

---

## Phase 12 — Constitutional and Integration Audit

### 12.1 Review Against Constitution

| Principle | Verification Method | Expected |
|---|---|---|
| Enterprise Before Features | Every workflow serves enterprise purpose | ✅ |
| Enterprise Information Engine | EIE used in Phase 6 | ✅ |
| Continuous Discovery | EIE discovery in Phases 6+9 | ✅ |
| AI Employees are Employees | Hermes AI in Phase 2 with roles | ✅ |
| Human-AI Collaboration | Phases 4, 5, 7 | ✅ |
| Hermes as Organizational Interface | Hermes orchestrates, doesn't absorb | ✅ |
| Organization Memory | Phase 10 | ✅ |
| Governance Before Automation | Phase 8 approvals | ✅ |
| Progressive Autonomy | AI autonomy levels in Phase 2 | ✅ |
| Event-Driven Organization | Phase 9 events | ✅ |
| Enterprise Learning Loop | Phase 11 lessons learned | ✅ |

### 12.2 Integration Audit

Checklist:
- [ ] Every module invoked at least once across all phases
- [ ] No data loss between phases
- [ ] Cross-module consistency (e.g., project financials match finance records)
- [ ] Tenant isolation verified (Ali Associates data NOT visible to other tenants)
- [ ] Authentication enforced on every action
- [ ] No silent errors in browser console during any phase

---

## Evidence Capture Protocol

For every phase, capture:
1. Screenshot of key UI state
2. Route URL
3. User identity
4. Expected vs actual result
5. Console errors (if any)
6. Network request failures (if any)
7. Related backend log entries

---

## Gap Classification Legend

| Code | Meaning |
|---|---|
| BUG | Implemented capability behaves incorrectly |
| INT-GAP | Modules exist but don't work together |
| WFLOW-GAP | Feature exists but workflow can't complete |
| CONST-VIOL | Behavior conflicts with Constitution |
| UX-GAP | Technically possible but confusing |
| MISSING | Required capability not implemented |
| DATA-RISK | Data integrity issue |
| SEC-RISK | Security / tenant isolation issue |
| AI-GAP | AI Employee behavior issue |
| EVENT-GAP | Event architecture issue |
