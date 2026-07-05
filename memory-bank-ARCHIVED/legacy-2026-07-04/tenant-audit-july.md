# Tenant Audit — Backend ↔ Frontend-Tenant Audit (July 2026)

Date: 2026-07-02
Scope: Audit-relevant features across `backend/src/modules/audit` and how
they surface (or fail to surface) inside `frontend-tenant`.

---

## 1. Backend audit surface

### 1.1 Module layout

| File | Purpose |
| --- | --- |
| `backend/src/modules/audit/audit.module.ts` | `@Global()` module — exports `AuditService` so any controller can inject it without re-importing. Registered in `app.module.ts:129`. |
| `backend/src/modules/audit/audit.service.ts` | `log()`, `findAll()`, `findByAgent()`. Skips DB writes for non-UUID actors (anon/interceptor noise). |
| `backend/src/modules/audit/audit.controller.ts` | REST: `GET /v1/audit-logs`, `GET /v1/audit-logs/tenant`, `GET /v1/audit-logs/agent/:agentId`. |
| `backend/src/modules/audit/dto/audit-log-response.dto.ts` | Wire shape (`AuditLogResponseDto`) with nested `AuditLogUserDto`. |
| `backend/src/common/interceptors/audit.interceptor.ts` | Global interceptor — auto-logs every mutating `POST/PUT/PATCH/DELETE` to `audit_logs`. GETs skipped (volume). Supports per-route `@Audit({action, resource})` decorator. Fire-and-forget on write. |
| `backend/prisma/schema.prisma:532` | `AuditLog { actor, action, resource, resourceId, tenantId, ipAddress, userAgent, result, details, createdAt, user?, tenant? }`. Indexed on `tenantId`, `actor`, `action`, `createdAt`. |

### 1.2 Endpoints exposed

| Method | Path | RBAC | Behavior |
| --- | --- | --- | --- |
| `GET` | `/v1/audit-logs` | `SUPER_ADMIN`, `PLATFORM_ADMIN`, `SECURITY_OFFICER`, `AUDITOR` | Platform-wide log; filters `tenantId/actor/action/resource/from/to`; paged. |
| `GET` | `/v1/audit-logs/tenant` | Any authenticated user with `tenantId` | Tenant-scoped log (force-scoped to `user.tenantId`). |
| `GET` | `/v1/audit-logs/agent/:agentId` | Any authenticated user with `tenantId` | Per-agent log (`resource='agent'`, `resourceId=agentId`). |

### 1.3 Wire shape (what the API returns)

```ts
AuditLogResponseDto {
  id: uuid,
  actor: string,            // userId (UUID) — never 'anonymous'
  action: string,           // e.g. "auth.login", "agent.create"
  resource?: string,
  resourceId?: uuid,
  tenantId?: uuid,
  ipAddress?: string,
  userAgent?: string,
  result: 'success' | 'failure',
  details?: Record<string, unknown>,
  createdAt: Date,
  user: { id, email, firstName, lastName }
}
```

Note: there is **no** top-level `entityType`, `entityId`, `description`, or
`metadata` field — those are the *frontend's* locally-declared shape (see §2).

### 1.4 Write paths

- `AuditInterceptor` writes every mutating HTTP request → `AuditService.log()`.
- `AuditService.log()` writes to `audit_logs` with `tenantId` derived from JWT.
- Direct callers: `AuditService` is `@Global`; explicit callers visible in repo:
  - `audit.controller.ts` (read-only).
  - No other module currently injects `AuditService` for writes — the
    interceptor is the de-facto producer.

---

## 2. Frontend-tenant audit surface

### 2.1 Files that reference audit

| File | Lines | Role |
| --- | --- | --- |
| `frontend-tenant/src/app/service-desk/page.tsx` | 86–95, 564–653 | Declares local `AuditLog` interface and renders the only audit UI: a tab inside the Service Desk ("Inbox · Approvals · Audit Log · Activity"). |
| `frontend-tenant/src/app/marketplace/page.tsx` | 246 | `if (action === 'audit')` — dispatches an "audit" action from `AgentCard` to inspect an agent (does **not** fetch audit logs; delegates to inspect). |
| `frontend-tenant/src/components/agent-card/AgentCard.tsx` | 160 | `onClick={() => handleAction('audit')}` — button on each agent card. |
| `frontend-tenant/src/types/ui.types.ts` | 21 | `AgentCardAction = 'pause' | 'resume' | 'retrain' | 'audit' | 'inspect' | 'delete'` — declares `'audit'` as a UI action. |

### 2.2 AuditTab implementation (`service-desk/page.tsx:564–653`)

What it does:
- Calls `GET /audit-logs/tenant?limit=200`.
- Renders a list: action badge, `entityType`, `entityId.slice(0,8)`, optional
  `description`, `actor.email`, timestamp.
- Search filter on `action | entityType | description | actor.email`.
- Manual `Refresh` button (no auto-refresh, no pagination).

### 2.3 Frontend ↔ Backend shape mismatch

The `AuditLog` interface declared at `service-desk/page.tsx:86` does **not**
match the backend `AuditLogResponseDto`:

| Frontend field | Backend field | Status |
| --- | --- | --- |
| `entityType: string` (required) | `resource?: string` | semantic match, but backend allows `undefined` |
| `entityId: string` (required) | `resourceId?: uuid` | same |
| `description?: string` | `details?: Record<string, unknown>` | **mismatch** — frontend wants a string, backend returns an object |
| `metadata?: Record<string, unknown>` | — | not returned by API |
| `actor: { firstName?, lastName?, email? }` | `actor: string` (UUID) **and** `user: { id, email, firstName, lastName }` | mismatch — frontend reads `log.actor.email`, backend exposes `log.user.email` |
| `action: string` | ✓ | match |
| `createdAt: string` | ✓ | match |

**Runtime impact:** in production the tab will render `undefined` for
`entityType`, `entityId`, `description`, and `actor.email`, since none of those
fields exist on the actual API payload. The UI may show "No audit entries"
even when logs exist if `entityType` ever returns `undefined` and a search
filter is applied.

### 2.4 Coverage gaps in frontend-tenant

| Gap | Detail |
| --- | --- |
| No `/audit-logs/agent/:agentId` consumer | The `AgentCardAction='audit'` button dispatches `inspect`, not a fetch against the agent-scoped audit endpoint. The per-agent audit trail endpoint exists but is unused. |
| No filtering UI | Backend supports `tenantId/actor/action/resource/from/to` paging; only search-by-text is exposed client-side. |
| No pagination | Hard-coded `limit=200`. |
| No date range picker | `from`/`to` query params not surfaced. |
| No result badge | `result: 'success' \| 'failure'` exists on backend but no styling for failures. |
| No IP / user-agent display | Backend exposes both; UI ignores them. |
| No streaming / live updates | Activity tab uses polling; Audit tab does not. |

---

## 3. Cross-system alignment map

```
backend/audit                  frontend-tenant/service-desk
─────────────────              ───────────────────────────
GET /v1/audit-logs             (admin only — out of tenant scope)
GET /v1/audit-logs/tenant  ──► AuditTab (service-desk/page.tsx)
GET /v1/audit-logs/agent/:id   (UNUSED — candidate for AgentCard 'audit' action)
AuditService.log()     ──►     (write-side, transparent to frontend)
AuditInterceptor       ──►     (write-side, transparent to frontend)
```

---

## 4. Recommended follow-ups

1. **Fix shape mismatch** — either (a) update the frontend `AuditLog`
   interface to read `log.resource`, `log.resourceId`, `log.user.email`,
   `log.details`, or (b) add a derived `entityType`/`entityId`/`description`
   mapper on the API side. Option (b) is cleaner — keeps the UI shape stable
   for downstream consumers (admin/frontend).
2. **Wire per-agent audit** — when `AgentCard` action `audit` fires, call
   `GET /v1/audit-logs/agent/:id` and route to a new audit drawer.
3. **Add filters + pagination** — surface `from/to/action/resource` and a
   page cursor.
4. **Highlight failures** — render `result === 'failure'` with a destructive
   variant so compliance officers spot denied actions quickly.
5. **Move audit UI out of Service Desk** — Service Desk is a triage surface;
   a dedicated `/audit` route (or a top-level nav item) fits better.

---

## 5. Quick references

- Backend module: `backend/src/modules/audit/`
- Backend interceptor: `backend/src/common/interceptors/audit.interceptor.ts`
- Schema: `backend/prisma/schema.prisma:532` (`AuditLog`)
- Frontend audit UI: `frontend-tenant/src/app/service-desk/page.tsx:564`
- Frontend AgentCard audit action: `frontend-tenant/src/components/agent-card/AgentCard.tsx:160`
