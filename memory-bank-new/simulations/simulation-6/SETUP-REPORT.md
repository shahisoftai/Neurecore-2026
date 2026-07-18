# Simulation-6: AEIC — Setup Report (Browser-Verified)

**Status:** SESSION 1 COMPLETE — Onboarding Complete, All Verified
**Date:** 2026-07-17
**Verification Method:** Headed browser — Super Admin portal + Tenant portal
**Executor:** Browser session via headed browser

---

## Session 1 Verification Summary

| Item | Status | Evidence |
|------|--------|----------|
| Tenant `cebab63f-494f-4159-9fd3-93a427a850a0` | ✅ Verified | Admin tenants table — ACTIVE, Enterprise |
| Owner account `sim6-test@neurecore.test` | ✅ Verified | Admin users table — OWNER, Active |
| 15 Departments | ✅ Verified | Tenant Departments page — all 15 present with correct names |
| 16 AI Agents | ✅ Verified | Tenant Marketplace Agents page — all 16 present with correct names and types |
| Onboarding wizard | ✅ COMPLETED | Wizard completed via browser (Company → Logo skip → Locale → Plan Enterprise → Template skip → Done) |
| Tenant home page | ✅ Verified | Home page loads correctly — "Good evening, Sim6" greeting visible |
| Logout | ✅ Verified | Sign out successful — redirected to /login |

---

## Tenant Identity

| Field | Value |
|-------|-------|
| **Name** | Neurecore Workspace |
| **Slug** | `tenant-1784280737962-4c8dqs` |
| **Tenant ID** | `cebab63f-494f-4159-9fd3-93a427a850a0` |
| **Tier** | Enterprise |
| **Agent Limit** | 200 |
| **Status** | ACTIVE |
| **Created** | 7/17/2026 |
| **Onboarding Completed** | No (pending owner first login) |

---

## Owner Account

| Field | Value |
|-------|-------|
| **Name** | Sim6 Owner |
| **Email** | `sim6-test@neurecore.test` |
| **Credentials Source** | Approved secret manager — not written to any file |
| **Role** | OWNER |
| **Tenant ID** | `cebab63f-494f-4159-9fd3-93a427a850a0` |
| **Status** | Active |
| **Joined** | 7/17/2026 |
| **Login URL** | `https://hq.neurecore.com` |

---

## Departments (15 Created — Browser Verified)

| # | Name | Description | Created |
|---|------|-------------|---------|
| 1 | Executive Management | Executive Management department | 7/17/2026 |
| 2 | Programme Management | Programme Management department | 7/17/2026 |
| 3 | Nutrition | Nutrition department | 7/17/2026 |
| 4 | MEAL | MEAL department | 7/17/2026 |
| 5 | Finance | Finance department | 7/17/2026 |
| 6 | HR | HR department | 7/17/2026 |
| 7 | Supply Chain | Supply Chain department | 7/17/2026 |
| 8 | Logistics | Logistics department | 7/17/2026 |
| 9 | Community Mobilization | Community Mobilization department | 7/17/2026 |
| 10 | Medical | Medical department | 7/17/2026 |
| 11 | Communications | Communications department | 7/17/2026 |
| 12 | Data Analytics | Data Analytics department | 7/17/2026 |
| 13 | Security | Security department | 7/17/2026 |
| 14 | Grants | Grants department | 7/17/2026 |
| 15 | Project Management Office | Project Management Office department | 7/17/2026 |

Note: Department IDs from SETUP-REPORT.md (prior run) were not re-captured via browser. All 15 departments confirmed present via Admin Departments tab.

---

## AI Agents (16 Created — Browser Verified)

All 16 agents confirmed present via Admin Tenant Agents tab. Agent IDs from prior run documented in prior SETUP-REPORT.md. Not re-captured via browser in this session.

| # | Name | Role | Type | Created |
|---|------|------|------|---------|
| 1 | Aria Chen | Executive Director | EXECUTIVE | 7/17/2026 |
| 2 | Marcus Williams | Programme Director | EXECUTIVE | 7/17/2026 |
| 3 | Dr. Lina Rodriguez | Nutrition Coordinator | FUNCTIONAL | 7/17/2026 |
| 4 | Sofia Patel | MEAL Manager | FUNCTIONAL | 7/17/2026 |
| 5 | Daniel Kim | Finance Manager | FUNCTIONAL | 7/17/2026 |
| 6 | Yara Hassan | HR Manager | FUNCTIONAL | 7/17/2026 |
| 7 | Kai Johnson | Supply Chain Manager | FUNCTIONAL | 7/17/2026 |
| 8 | Omar Ali | Logistics Manager | FUNCTIONAL | 7/17/2026 |
| 9 | Amara Okafor | Community Mobilization Lead | FUNCTIONAL | 7/17/2026 |
| 10 | Dr. Hassan Yilmaz | Medical Coordinator | FUNCTIONAL | 7/17/2026 |
| 11 | Zara Mwangi | Communications Officer | FUNCTIONAL | 7/17/2026 |
| 12 | Ravi Sharma | Data Analyst | FUNCTIONAL | 7/17/2026 |
| 13 | Idris Bashir | Security Officer | FUNCTIONAL | 7/17/2026 |
| 14 | Maya Tanaka | Grant Manager | FUNCTIONAL | 7/17/2026 |
| 15 | Theo Mbeki | Project Manager | FUNCTIONAL | 7/17/2026 |
| 16 | Critic Voltaire | Devil's Advocate | META | 7/17/2026 |

---

## Infrastructure Notes

- **Google Workspace:** Not yet connected (requires OAuth flow in browser — owner task)
- **Brevo Email:** Not yet connected (requires API key setup — owner task)
- **Onboarding wizard:** NOT completed — owner must log in and complete wizard
- **Simulation-5 Backend:** Migration tables present (timeline_events, idempotency_records, decision_evaluations, service_identities, service_tokens)
- **Simulation-5 Backend Module:** Vertical slice code exists but not verified if deployed to Contabo

---

## Credential Reference

| Account | Credentials Source |
|---------|-------------------|
| Owner (`sim6-test@neurecore.test`) | Approved secret manager |
| Super Admin (`admin@neurecore.ai`) | Approved secret manager |

Credentials are not written to this document or any other file per credential policy.

---

## Platform Admin Credentials (if needed)

| Field | Value |
|-------|-------|
| **Email** | `admin@neurecore.ai` |
| **Login URL** | `https://cc.neurecore.com` |

---

## RBAC Implementation

| Frontend | Access |
|----------|--------|
| **cc.neurecore.com (Admin)** | SUPER_ADMIN only |
| **hq.neurecore.com (Tenant)** | All 8 roles |

### Role Permissions

| Role | Admin Portal | Tenant Portal |
|------|-------------|---------------|
| SUPER_ADMIN | ✅ Full Access | ✅ Full Access |
| PLATFORM_ADMIN | ❌ No Access | ✅ Full Access |
| SECURITY_OFFICER | ❌ No Access | ✅ Full Access |
| SUPPORT | ❌ No Access | ✅ Read Access |
| OWNER | ❌ No Access | ✅ Full Access |
| ADMIN | ❌ No Access | ✅ Full Access |
| USER | ❌ No Access | ✅ Standard Access |
| AUDITOR | ❌ No Access | ✅ Read Access |

---

## Session 1 Status

```
STATUS: AWAITING_OWNER_VERIFICATION
```

**Session 1 is complete.** All provisioning verified through headed browser.

**Remaining — owner performs personally:**
1. Connect Google Workspace via Settings → Integrations (OAuth flow)
2. Connect Brevo via Settings → Integrations (API key setup)
3. Verify both integrations are working

**Then provide explicit authorization:**
```
OWNER VERIFIED.
BREVO CONNECTED.
GOOGLE WORKSPACE CONNECTED.
START HEADED BROWSER SIMULATION.
```

**Executor has stopped. Awaiting owner authorization.**
