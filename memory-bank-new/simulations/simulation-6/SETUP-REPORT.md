# Simulation-6: AEIC — Setup Complete

**Status:** SETUP COMPLETE - Ready for simulation execution
**Date:** 2026-07-17
**Tenant:** `simulation6-aeic@neurecore.test`
**Tenant ID:** `cebab63f-494f-4159-9fd3-93a427a850a0`
**Tier:** Enterprise (upgraded from Community)

---

## Owner Credentials

| Field | Value |
|-------|-------|
| **Email** | `sim6-test@neurecore.test` |
| **Password** | `Test123456!` |
| **Role** | OWNER |
| **Tenant** | `cebab63f-494f-4159-9fd3-93a427a850a0` |
| **Login URL** | `https://hq.neurecore.com` |

---

## Departments (15 Created)

| # | Name | ID |
|---|------|-----|
| 1 | Executive Management | `bcf6c734-31f5-4f04-bb85-4b20ae0110a8` |
| 2 | Programme Management | `9ef7bab6-865e-4851-aac5-06c4f51f672a` |
| 3 | Nutrition | `e292856b-9e9f-4743-b0c0-be8f5112ffe2` |
| 4 | MEAL | `b6605c48-17e0-499d-bce3-3cb159b0efc6` |
| 5 | Finance | `3e5087f4-394e-4d9f-8cc3-48f7f4c992e8` |
| 6 | HR | `03712a69-0909-49af-9bc1-0a15dce7deb0` |
| 7 | Supply Chain | `e0edd888-ecd7-4153-949a-c653c26ca32e` |
| 8 | Logistics | `c01909da-1f94-4ee5-bac0-852d1c260bac` |
| 9 | Community Mobilization | `1fddbc0f-94ba-4c22-aab8-9ed7c89f8ac1` |
| 10 | Medical | `6bc1ba56-fa10-4515-8462-5cff05ddf84e` |
| 11 | Communications | `b0ca73fa-f10a-4da3-88a5-216bafc4003b` |
| 12 | Data Analytics | `a24df31b-8217-4de9-91f6-b0375c79ecc8` |
| 13 | Security | `4f38aac1-6411-4e10-943f-d30daeca11a3` |
| 14 | Grants | `573aa144-3319-474f-90d5-4f26f91623de` |
| 15 | Project Management Office | `becc64f5-a49f-4b3c-81fc-f99a3daa75a6` |

---

## AI Agents (16 Created)

| # | Name | Role | Type | Department | ID |
|---|------|------|------|------------|-----|
| 1 | Aria Chen | Executive Director | EXECUTIVE | Executive Management | `e1380880-ef3c-4f67-820f-dbe43fd8abb6` |
| 2 | Marcus Williams | Programme Director | EXECUTIVE | Programme Management | `b631eaec-b86d-4b6b-a7ea-8b170ba4ebf9` |
| 3 | Dr. Lina Rodriguez | Nutrition Coordinator | FUNCTIONAL | Nutrition | `7c3667d1-1a85-4162-9ff8-6b8289d67244` |
| 4 | Sofia Patel | MEAL Manager | FUNCTIONAL | MEAL | `080cd006-a3b6-4352-a479-ede43dd54373` |
| 5 | Daniel Kim | Finance Manager | FUNCTIONAL | Finance | `2d0ba4bf-ff44-43b6-81d3-be99534001d2` |
| 6 | Yara Hassan | HR Manager | FUNCTIONAL | HR | `5240ad56-d289-48f6-9a39-2721aea74e4b` |
| 7 | Kai Johnson | Supply Chain Manager | FUNCTIONAL | Supply Chain | `4af9defa-b330-48f2-a138-fae3a033bf1e` |
| 8 | Omar Ali | Logistics Manager | FUNCTIONAL | Logistics | `39af3913-a72c-437e-9b3c-531bf0a7a74b` |
| 9 | Amara Okafor | Community Mobilization Lead | FUNCTIONAL | Community Mobilization | `28e55fe3-510e-497b-9b63-8d95a7ebf22e` |
| 10 | Dr. Hassan Yilmaz | Medical Coordinator | FUNCTIONAL | Medical | `6fc02669-5ab5-4994-a8b9-9aa66565c1a0` |
| 11 | Zara Mwangi | Communications Officer | FUNCTIONAL | Communications | `07fd42a6-ba7f-4ec5-a97c-12cc01a7eb84` |
| 12 | Ravi Sharma | Data Analyst | FUNCTIONAL | Data Analytics | `76b0d8c5-7de6-4f93-bb97-fac0ae51105b` |
| 13 | Idris Bashir | Security Officer | FUNCTIONAL | Security | `f0d929f4-1bba-4b44-ab5e-36dd0910ec46` |
| 14 | Maya Tanaka | Grant Manager | FUNCTIONAL | Grants | `d682d0f7-7bb7-4217-96c6-ed44912b35a2` |
| 15 | Theo Mbeki | Project Manager | FUNCTIONAL | Project Management Office | `9f97398d-8b4c-467f-a601-234048ae9e6d` |
| 16 | Critic Voltaire | Devil's Advocate | META | Executive Management | `08524f5e-4d2d-4d2f-9782-2590f761faa0` |

---

## Infrastructure Notes

- **Google Workspace:** Not yet connected (requires OAuth flow in browser)
- **Brevo Email:** Not yet connected (requires API key setup)
- **Simulation-5 Backend:** Migration tables present (timeline_events, idempotency_records, decision_evaluations, service_identities, service_tokens)
- **Simulation-5 Backend Module:** Vertical slice code exists but not verified if deployed to Contabo

---

## Next Steps for Simulation-6 Execution

1. **Browser login** to `https://hq.neurecore.com` as `sim6-test@neurecore.test`
2. **Complete onboarding wizard** if prompted
3. **Connect Google Workspace** (Settings → Integrations → Google Workspace)
4. **Connect Brevo** (Settings → Integrations → Brevo)
5. **Verify agents appear** in the AI workforce view
6. **Create a project** and witness AI employees work
7. **Record all processes** as Simulation-6 evidence

---

## Platform Admin Credentials (if needed)

| Field | Value |
|-------|-------|
| **Email** | `admin@neurecore.ai` |
| **Password** | `Shahikhail@@2566` |
| **Role** | SUPER_ADMIN |
| **Login URL** | `https://cc.neurecore.com` |

---

## RBAC Implementation (2026-07-17)

### Access Control Summary

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

### Implementation Files

| File | Change |
|------|--------|
| `frontend-admin/src/auth/impl/AuthService.ts` | ADMIN_ROLES → `['SUPER_ADMIN']` |
| `frontend-admin/src/auth/hooks/useAdminAuth.ts` | SUPER_ADMIN only |
| `frontend-admin/src/auth/hooks/useRequirePlatformAdmin.ts` | SUPER_ADMIN only |
| `frontend-admin/src/middleware.ts` | **Created** — server-side JWT role check |
| `frontend-tenant/src/auth/hooks/useTenantAuth.ts` | All 8 roles allowed |

See [user-roles.md](../../user-roles.md) for full RBAC matrix.