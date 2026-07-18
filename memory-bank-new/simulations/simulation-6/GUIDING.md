# **HONEST simulation on frontend tenant on browser, AS A TENANT WILL USE THIS PORTAL. NO Dishonet fake or deceptive moves.**

---

# NeuroCore Trusted Tenant Execution Protocol

## Browser-Only, Evidence-First Acceptance Guide

**Status:** AWAITING_OWNER_VERIFICATION
**Date:** 2026-07-17
**Protocol Version:** 2.0
**Document Version:** 7.0

---

## Authority Boundary

> My earlier authorization to provision the tenant does not authorize the executor to log in as the tenant, configure integrations, complete onboarding, create operational data, invoke agents, or begin the simulation. These actions require separate explicit authorization after my personal verification.

---

## Browser-Only Mandate (Applies to ALL Sessions and ALL Activities)

> **All simulation, all provisioning, all verification, and all evidence collection must be performed through the visible frontend browser only.**
>
> The frontend browser is the single source of truth and the single allowed execution surface for this entire protocol.

### Scope of "Browser-Only"

Every action listed below — whether during Session 1 (provisioning), Session 2 (owner verification support, if any), Session 3 (pre-simulation confirmation), Session 4 (headed browser simulation), or Session 5 (independent verification) — must be visible in the frontend browser. Specifically:

- Creating tenants
- Creating departments
- Creating AI agents
- Assigning agents to departments
- Verifying any entity exists
- Capturing any evidence
- Any operational data creation
- Any AI invocation
- Any integration use
- Any verification check (refresh, re-login, cross-tenant isolation, record lookup)

### Prohibited Surfaces

The following are explicitly **prohibited** at every stage of this protocol:

- Direct Prisma or SQL database access
- SSH terminal access
- Backend seed scripts or runners
- Administrative APIs not exposed through the tenant frontend
- Local JSON / Markdown reports generated without browser-sourced evidence
- Backend console / debug endpoints
- Super Admin panel for any action the tenant can perform through the frontend
- Reading tenant data via direct DB queries instead of through the browser
- Server-to-server API calls executed outside the visible browser

### Browser Activity Requirements (All Sessions)

- Headed browser only — headless mode is prohibited
- Visible mouse and keyboard activity
- Continuous screen recording before, during, and after any tenant interaction
- No switching to terminal, database client, SSH, or IDE during any run
- No background scripts that touch the tenant without browser action
- Every claim must be supported by a screenshot, URL, or visible element reference

If an action cannot be performed through the tenant frontend, it must be recorded as `BLOCKED` with a clear explanation — not bypassed via backend or admin tools.

---

## Burden of Proof

> The executor is responsible for proving every claim with platform evidence.
>
> The owner is **not** responsible for disproving unsupported claims.
>
> If sufficient evidence cannot be produced, the claim is automatically classified as **INCONCLUSIVE**.
>
> Claims without evidence must never be upgraded to PASS.

---

# MANDATORY HUMAN VERIFICATION GATE

## Two Separate Execution Sessions

This protocol is divided into two completely separate execution sessions.

---

### Session 1 — Tenant Provisioning Only

**Authority is limited to provisioning the tenant.**

**Permitted actions:**
- Create the tenant using the approved workflow
- Assign the approved subscription tier
- Create the tenant OWNER account
- Create all approved departments
- Create all approved AI agents
- Assign every AI agent to its correct department
- Verify that the tenant, departments, and AI agents exist

**Must stop immediately after completing these tasks.**

**Prohibited actions:**
- Create customers
- Create projects
- Create stages
- Create tasks
- Create knowledge entries
- Create communication threads
- Create decisions
- Create approvals
- Invoke any AI agent
- Send emails
- Create calendar events
- Connect Brevo
- Connect Google Workspace
- Perform onboarding on behalf of the owner
- Start any simulation
- Generate any simulation records
- Produce a simulation report
- Produce any readiness score

**Current provisioning status:** Per SETUP-REPORT.md, tenant, 15 departments, and 16 AI agents are already provisioned.

**Current status: AWAITING_OWNER_VERIFICATION — MANDATORY STOP**

---

### Session 2 — Owner Verification and Integration

The human owner must personally:

1. Log into the tenant at `https://hq.neurecore.com`
2. Verify tenant configuration
3. Verify all departments
4. Verify all AI agents
5. Complete any onboarding if required
6. Connect Google Workspace
7. Connect Brevo
8. Verify both integrations are working correctly

Only the owner performs these tasks. The executor must not perform them.

---

### Session 3 — Pre-Simulation Owner Confirmation

Before Session 4 begins, the executor must display the following checklist and wait for explicit owner confirmation that **every line is YES**:

```
Tenant verified by owner: ___
Departments verified by owner: ___
Agents verified by owner: ___
Onboarding completed by owner: ___
Google Workspace connected by owner: ___
Brevo connected by owner: ___
Owner present to observe: ___ (see definition below)
Explicit start authorization received: ___
```

If any answer is not `YES`, the executor must not open the simulation browser.

**"Owner present to observe"** means the owner is actively watching the headed browser execution in real time and may pause, question, or terminate the simulation at any moment. Asynchronous, recorded-after-the-fact, or delegated observation does not satisfy this requirement.

---

### Owner Pause Command

At any point during Session 4, the owner may issue:

```
OWNER PAUSE SIMULATION
```

When received, the executor must:

- Stop creating new records immediately
- Leave the headed browser open and visible
- Perform no additional actions
- Wait for further owner instructions (`RESUME`, `STOP`, or `TERMINATE`)

Pause does not invalidate the run. Suspension of work allows inspection without losing evidence already collected.

---

### Session 4 — Headed Browser Simulation (Begins Only After Explicit Authorization)

**The simulation must not begin until the human owner explicitly provides ALL of the following:**

```
OWNER VERIFIED.
BREVO CONNECTED.
GOOGLE WORKSPACE CONNECTED.
START HEADED BROWSER SIMULATION.
```

This exact approval is the **only** authorization to continue.

**The following do NOT authorize continuation:**
- Successful tenant creation
- Successful login
- Existing integrations
- Idle time
- Silence
- Assumptions
- Previous conversations
- Previous instructions
- Automatic workflows

If explicit authorization has not been received, the executor must remain stopped.

**After explicit authorization is received:**

1. Open the tenant in a headed browser
2. Start continuous screen recording before logging in
3. Perform every action through the visible tenant interface
4. Move slowly enough that the observer can see every action
5. Never use hidden scripts or background automation
6. Never perform actions outside the visible browser
7. Every created record must be immediately visible in the UI
8. Every created record must survive refresh and re-login
9. If an error occurs, document it exactly as observed
10. Never attempt to fix, bypass, or hide a failure during the simulation

**The purpose is for the observer to witness complete execution with their own eyes. If an action cannot be observed through the tenant interface, it will not be accepted as valid evidence.**

---

### Session 5 — Independent Verification

After Session 4 completes:

1. Reopen all created entities through the browser
2. Compare starting and ending record counts
3. Verify audit traces exist for all claimed actions
4. Check cross-tenant isolation
5. Verify integrations show external delivery evidence (Google Calendar + Brevo)
6. Produce report from evidence only — no narrative interpolation

---

## Five Formal Stages (Replacement for Old Three-Stage Model)

### Stage A — Tenant Provisioning Only

Create tenant, owner, tier, departments, and agents. Then stop.

### Stage B — Mandatory Handover

Provide setup report and status:

```
AWAITING_OWNER_VERIFICATION
```

No login, integrations, onboarding, operational records, or AI invocations.

### Stage C — Owner Verification and Integration

The human owner personally logs in, verifies the setup, completes onboarding, connects Google Workspace, connects Brevo, and tests both integrations.

### Stage D — Headed Browser Simulation

Begins only after the exact written authorization above.

### Stage E — Independent Verification

Verify persisted records, evidence, audit traces, integrations, and isolation.

---

## Immediate-Stop Conditions (Duplicate for Emphasis — Applies to All Sessions)

The simulation must stop and be declared **INVALID** if any of these occur:

- Direct database mutation detected
- Hidden seed script executed
- Local files presented as tenant records
- Fake or templated AI responses
- Deleted or altered evidence
- Missing continuous recording
- Super Admin intervention during execution
- Credential exposure
- Unsupported manual changes to the system state
- Claimed record absent from the portal after refresh
- Browser idle while background script runs
- Any prohibited action attempted or completed
- Integration connected or disconnected by the executor after Stage B

An INVALID run produces no score and must be restarted from Stage A.

---

## Zero Tolerance

> **Nothing counts unless it is visibly performed as the tenant, persisted in NeuroCore, recoverable after refresh and re-login, and independently traceable through platform evidence.**

This is an anti-deception protocol. It exists because lightweight walkthrough checklists cannot distinguish real tenant work from scripts, direct database changes, fabricated screenshots, or local JSON reports presented as platform evidence.

---

## Credential Policy

**Credentials must never appear in this document, evidence packages, screenshots, logs, or Git commits.**

| Field | Value |
|-------|-------|
| **Credentials Source** | Approved secret manager |
| **Account** | Simulation-6 Tenant Owner |
| **Tenant ID** | `cebab63f-494f-4159-9fd3-93a427a850a0` |
| **Login URL** | `https://hq.neurecore.com` |

Executor must retrieve credentials from the approved secret manager immediately before execution. No credentials may be written to any file or chat message.

---

## Roles

### Executor
Performs browser actions and records evidence. Must execute every operational action through the same visible screens, controls, permissions, workflows, and integrations available to an ordinary tenant OWNER.

### Verifier
Reviews evidence against tenant records but cannot modify anything. The verifier must challenge every claim: "Show the record in the portal," "Show the request ID," "Show that it survived refresh," "Show that it was created by the tenant account," "Show that no admin or DB bypass was used." The verifier may downgrade `PASS` to `INCONCLUSIVE` or `FAIL`.

---

## Permitted and Prohibited Execution Methods

### Permitted
- Tenant frontend through the visible headed browser only
- Network requests naturally initiated by frontend actions
- Normal tenant APIs called by the frontend
- Approved external integrations used through tenant settings
- Read-only inspection of browser console and network traffic
- Read-only inspection of browser developer tools

### Prohibited
- Direct Prisma or SQL modifications
- SSH-based data creation or correction
- Backend seed scripts
- Calling administrative APIs unavailable to the tenant
- Creating records through hidden scripts while the browser remains idle
- Generating local JSON or Markdown and presenting it as platform evidence
- Static or templated AI conversations presented as model output
- Manually altering evidence files
- Changing tenant tier through the database
- Editing source code during the simulation
- Using Super Admin to complete an action the tenant should perform
- Marking an item passed because an API returned `200`
- Using `Math.random()` or templates to generate fake dialogue
- Any mid-run remediation: fixing configuration, editing data, changing permissions, restarting services, adding missing records, or altering code
- Connecting, disconnecting, or reconfiguring Google Workspace or Brevo after Stage B

---

## Acting Fully as a Tenant

The executor must remain inside the authority and capabilities of the tenant OWNER role.

> If a required action is impossible through the tenant portal, record it as `BLOCKED`. Do not bypass the limitation. Do not use Super Admin, backend console, or direct database access to complete it.

A tenant simulation must not silently become a developer simulation or administrator simulation.

---

## Observable Browser Activity Requirements

The following are **mandatory** for every test:

- Headed browser only — headless mode is prohibited
- Visible mouse and keyboard activity throughout the session
- Continuous recording from login to logout — no pauses, no cuts
- Timestamp visible in the recording
- No switching to terminal, database client, SSH, or IDE during the run
- Each record creation must be visible in the browser interface
- The created record must be reopened and verified through the interface
- Refreshing the page must preserve the record
- Logging out and back in must still show the record
- No hidden background execution

### Browser Window Freeze Rule

The executor must not minimize, hide, move off-screen, replace, or switch away from the headed browser while the simulation is running unless explicitly instructed by the owner.

> A browser opening while a background script performs fake work must be classified as **deception**.

---

## Evidence Before Narration

The executor must present evidence **before** explanation.

For every claim, the order is fixed:

1. Show the platform record (screenshot or UI reference)
2. Show the record ID
3. Show the audit trace or request ID
4. Then explain what happened

Narratives such as *"Customer created successfully"* without the prior three pieces of evidence are non-authoritative. Persuasive description must never precede proof.

---

## Onboarding Wizard Workflow (How the System Actually Works)

After a tenant is created and the OWNER logs in for the first time, the system auto-redirects to `/onboarding/setup` (the Tier-1 wizard). The wizard handles:

1. **Company** — name, industry, address
2. **Logo** — branding upload
3. **Localization** — timezone, currency, locale
4. **Plan** — **tier selection** (Starter / Community / Enterprise)
5. **Template** — industry template selection
6. **Complete** — submits `POST /onboarding/complete`, seeds the onboarding checklist, redirects to `/home`

After wizard completion, the owner lands in the tenant portal home and the **left navigation** exposes dedicated pages for managing:

- Departments (under Organization / Team / Structure section)
- AI Agents / AI Workforce
- Tier and Billing
- Integrations (Google Workspace, Brevo)
- All other tenant settings

### Important Constraint

The onboarding wizard does **NOT** include department or AI agent creation. Those entities must be set up through their dedicated pages in the left navigation **after** the wizard completes. Tier can be chosen in the wizard at "Plan" step or changed later in Billing settings.

### Implications for This Protocol

- For Session 1 provisioning: if the wizard has not been completed yet, the executor may use it to set tier. Departments and AI agents must be created through the dedicated left-nav pages afterward.
- The owner (Session 2) may complete the wizard themselves if it is still pending, then continue to their dedicated management pages for verification and additions.
- All of the above is still done through the **visible frontend browser** — no backend or admin shortcut.

---

## Defect Handling — Record First, Do Not Fix Mid-Run

**Rule:** Record the defect. Do not fix during the same simulation run.

### For All Issues

1. Capture the issue with screenshot, trace ID, expected vs actual result.
2. Mark the affected test `FAIL` or `INCONCLUSIVE`.
3. Continue the simulation if the issue does not corrupt later results.
4. Add it to a remediation backlog.
5. Fix it only after the run ends.
6. Start a fresh verification run for the affected workflow.

### Pause Thresholds

Only pause the simulation when the issue may affect:

- Later evidence
- Data integrity
- Permissions
- Integrations
- AI behavior

### Why This Rule Exists

This preserves an honest baseline. Fixing code mid-run would mix two product versions and make the final score unreliable — even if the bug is tiny. Tiny bugs have a talent for wearing fake moustaches.

### Evidence Required for Each Defect Entry

```
Defect ID: [unique identifier]
Detected at: [ISO 8601 timestamp from recording]
Test ID: [parent test reference]
Page URL: [URL where defect was observed]
Action attempted: [what the executor did]
Expected result: [what should have happened]
Actual result: [what actually happened]
Trace ID: [platform trace ID or network request ID]
Screenshot: [filename or evidence ID]
Severity: [CRITICAL / HIGH / MEDIUM / LOW]
Affects later tests: [YES / NO]
Decision: [CONTINUE / PAUSE]
Backlog entry created: [YES / NO]
Remediation run ID: [filled in only after fix is applied in a new run]
```

The defect entry must be added to the remediation backlog **before** the simulation ends. Remediation must not begin until the run is officially closed.

---

## Evidence Chain Bundle Format

Every important action must produce a complete evidence bundle:

```
Test ID: [unique identifier]
Timestamp: [ISO 8601 with timezone]
User and tenant role: [role from approved credentials]
Page URL: [full URL at time of action]
Action performed: [exact action taken]
Expected result: [what should happen]
Actual result: [what actually happened]
Before screenshot: [filename or evidence ID]
After screenshot: [filename or evidence ID]
Network request: [request ID from dev tools]
HTTP response status: [code]
Created record ID: [platform-assigned ID]
Audit trace or request ID: [platform trace ID]
Post-refresh verification: [PASS/FAIL]
Status: [PASS/FAIL/BLOCKED/INCONCLUSIVE/NOT_TESTED]
```

No test may be marked `PASS` without a retrievable record ID or other objective proof from the platform itself.

---

## Evidence Hierarchy

Evidence is ranked from strongest to weakest. The executor's written claim is the **weakest** evidence.

| Rank | Type | Authority |
|------|------|-----------|
| 1 | Persisted tenant-visible record | Highest — platform is authoritative |
| 2 | Audit entry or trace ID | High — platform-generated |
| 3 | Network request and response | High — captured from live session |
| 4 | Screen recording | Medium — continuous, timestamped |
| 5 | Screenshot | Low — can be faked or cherry-picked |
| 6 | Executor narrative | Lowest — self-reported |

Local files may store copies of evidence but cannot prove an action occurred. The platform record is authoritative.

---

## Mandatory Truth Labels

Every test must end in **exactly one** of these statuses:

| Status | Definition |
|--------|------------|
| `PASS` | Action completed as expected with traceable platform evidence |
| `FAIL` | Action did not complete as expected — documented exactly as experienced |
| `BLOCKED` | Action could not be attempted because the tenant portal does not support it |
| `INCONCLUSIVE` | Insufficient evidence to determine outcome — not the same as PASS |
| `NOT_TESTED` | Test was not executed |

> **Absence of an error is not evidence of success.** Lack of sufficient evidence must be classified as `INCONCLUSIVE`, never `PASS`. No `PARTIAL PASS` unless passed and failed components are listed separately with individual evidence bundles.

---

## Strengthened Success Criteria

All of the following must be true for a successful simulation:

| # | Criterion |
|---|-----------|
| 1 | 100% of claimed records visible after refresh and re-login |
| 2 | 100% of passed tests have traceable evidence |
| 3 | Zero direct database operations |
| 4 | Zero hidden background scripts |
| 5 | Zero locally fabricated operational artifacts |
| 6 | Zero use of Super Admin after execution begins |
| 7 | Zero credentials or secrets in evidence |
| 8 | All blocked workflows reported as blocked |
| 9 | All integration actions confirmed by external delivery evidence |
| 10 | All AI outputs generated through the configured runtime and stored in the tenant |
| 11 | All report figures reconcilable with tenant-visible records |
| 12 | Zero evidence files altered after collection |
| 13 | Zero integrations connected or reconfigured by executor after Stage B |

---

## AI Output Authenticity Controls

When testing AI agents, the following are **mandatory**:

- Actual configured agent invoked (not a mock or placeholder)
- Provider and model recorded from platform config
- Prompt version recorded
- Invocation ID and trace ID recorded
- Tool calls recorded
- Token use and latency recorded
- Output persisted in the tenant's platform record
- Static templates are prohibited
- Local `Math.random()`-generated dialogue is prohibited
- A model failure must remain a failure — not replaced with manually written output
- Every AI-generated output must be reproducibly linked to its invocation by invocation ID or trace ID. If an output cannot be traced to a recorded invocation, it must be treated as **non-authoritative**.

---

## Expanded Test Phases (Session 4 — Headed Browser Simulation)

### Phase 1: Login and Session Integrity
1. Navigate to `https://hq.neurecore.com`
2. Authenticate using credentials from approved secret manager
3. Complete any onboarding wizard if prompted
4. Verify session persists on page refresh
5. Verify session persists after logout and re-login
6. Confirm all visible elements match tenant tier

### Phase 2: Core Entity Creation
1. Create a **Customer** through the tenant portal — verify it appears in the customer list
2. Create a **Project** linked to that customer — verify it appears in the project list
3. Create **Project Stages** — verify they appear in stage list
4. Create **Tasks** within the project — verify they appear and are assignable
5. Create **Knowledge Entries** — verify they are searchable
6. Create a **Communication Thread** — verify it appears in thread list
7. Create a **Decision Record** — verify it appears in decision ledger
8. Create an **Approval Request** — verify it appears in approval queue

### Phase 3: AI Workforce Operations
1. Navigate to AI workforce section
2. Identify the 16 AI agents configured for this tenant
3. Assign a task to an AI agent through the tenant interface
4. Invoke the agent through the tenant portal
5. Record the invocation ID and trace ID
6. Verify agent output persisted in the tenant
7. Confirm provider, model, and prompt version are visible
8. Test agent interaction with another task

### Phase 4 — Integration Use Verification (Executor Does NOT Connect)

1. Confirm Google Workspace is already connected by the owner.
2. Confirm Brevo is already connected by the owner.
3. Do not modify, reconnect, disconnect, or reconfigure either integration.
4. Create a calendar meeting through the normal tenant interface.
5. Verify the meeting appears in Google Calendar.
6. Send an email through the normal tenant interface.
7. Verify delivery through Brevo.
8. Record failures exactly as observed.

### Phase 5: Access Control Testing
1. Create a secondary user with reduced permissions (e.g., USER role)
2. Log in as the secondary user
3. Attempt operations blocked for that role — confirm they fail safely
4. Attempt operations permitted for that role — confirm they succeed
5. Log out and back in as OWNER
6. Verify all records created by secondary user are visible

### Phase 6: Data Persistence and Isolation
1. Navigate to each entity type created in Phase 2
2. Confirm each record is retrievable by direct URL or navigation
3. Confirm each record survives page refresh
4. Confirm each record survives logout and re-login
5. Attempt cross-tenant access — confirm isolation is enforced
6. Verify all record counts match expected values

### Phase 7: Complete Session Documentation
1. Perform final logout
2. Confirm continuous recording captured entire session
3. Verify all evidence bundles are complete
4. Verify no credentials appear in any evidence file
5. Package evidence for Verifier review

---

## Evidence Collection Structure

All simulation evidence must be stored in:

```
simulations/simulation-6/evidence/
├── evidence-index.json          # Master index of all evidence bundles
├── session-recording/           # Continuous screen recording
├── screenshots/                 # Individual screenshots named by test ID
├── network-logs/                # Browser network traffic exports
├── browser-logs/                # Console logs from browser dev tools
├── ai-traces/                   # AI invocation traces with IDs
└── verifier-report/             # Verifier's independent assessment
```

Every file name must include the Test ID and timestamp. No file may be modified after collection.

---

## Pre-Simulation Checklist (To Be Confirmed by Owner in Session 3)

- [ ] Tenant verified by owner
- [ ] Departments verified by owner
- [ ] Agents verified by owner
- [ ] Onboarding completed by owner
- [ ] Google Workspace connected by owner
- [ ] Brevo connected by owner
- [ ] Owner present to observe
- [ ] Explicit start authorization received

---

## Disclaimer

This protocol prioritizes **honest observation** over system optimization. Any bugs, UX issues, failures, or unexpected behaviors discovered will be documented faithfully without attempt to mask, repair, or manipulate findings during the run.

Any remediation must occur in a separate remediation session, followed by a completely new simulation run.

---

**Protocol Version:** 2.0
**Document Version:** 7.0
**Created:** 2026-07-17
**Status:** AWAITING_OWNER_VERIFICATION
