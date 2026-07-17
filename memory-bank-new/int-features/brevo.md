# Brevo Email Integration — Audit (2026-07-17)

> **Phase-1 (core wiring + master-key bootstrap) + Phase-2 (smoke scripts + unit tests) + Phase-3 (webhooks + bulk send + per-tenant sender identity) + Phase-4 (admin dashboard + suppression list + client-side route guard) + Phase-5 (tenant UI enhanced setup experience).**
> This audit reflects the current state of `neurecore/backend/src/modules/integrations/brevo/`, `neurecore/backend/prisma/`, `neurecore/frontend-admin/src/app/admin/brevo/`, `neurecore/frontend-tenant/src/app/settings/integrations/`, and `memory-bank-new/int-features/brevo.md` after the Phase-1 → Phase-5 changes. See §8 for the change list and new file references.

## 1. Overview

NeureCore uses [Brevo](https://www.brevo.com) as its transactional email relay. The pipeline is **hybrid**: each tenant can connect its own Brevo API key (custom sender identity, isolated billing, dedicated 300-msg/day quota pool), and tenants without their own key transparently fall back to a platform **master key** (`BREVO_MASTER_API_KEY`). This lets new tenants send email day-1 without manual setup, while giving established tenants a per-tenant sender domain and a separate quota counter.

**Master-key decoding** accepts two formats — bare (`xkeysib-…`) or base64-wrapped JSON (`{"api_key":"xkeysib-…"}`) — and exposes a single normalized `BREVO_MASTER_API_KEY` via the existing `ConfigurationService.getBrevo()`.

**Implementation Status Matrix:**

| Capability | Backend Service | REST Endpoints | Tenant UI | Admin UI | Agent Tool |
|---|---|---|---|---|---|
| Key resolution + master-key fallback | `BrevoEmailService.getApiKey()` | n/a | n/a | n/a | n/a |
| Single transactional send | `BrevoEmailService.sendEmail()` | `POST /integrations/brevo/test-send` | via `EmailProviderFactory` | `GET /integrations/brevo/validate` | ✅ `EmailTool` |
| Bulk send (≤ 50 recipients) | `BrevoEmailService.sendBatch()` | `POST /integrations/brevo/send-batch` | via `EmailProviderFactory` | n/a | ✅ `EmailTool` (multi-recipient `to[]`) |
| Per-tenant sender identity | `BrevoEmailService.getTenantIdentity()` | `GET/PUT/DELETE /integrations/brevo/sender` | via service | visible in tenants table | propagated via `EmailTool` |
| Suppression list (bounce + unsub + admin) | `BrevoSuppressionService` | sender-side check (in `BrevoEmailService`), `GET/POST/DELETE /admin/brevo/suppressions[/:id]` | n/a | ✅ full explorer at `/admin/brevo/suppressions` | hard-skipped via `isSuppressed` |
| Webhook ingestion | `BrevoWebhookService.handle()` | `POST /integrations/brevo/webhook` (HMAC-SHA256, public) | n/a | `GET /integrations/brevo/events` | n/a |
| Webhook → suppression hook | `BrevoWebhookService.handle` → `BrevoSuppressionService.upsert` | n/a | n/a | reflected in `stats.suppressions` | n/a |
| Hard-bounce → quota refund | `BrevoWebhookService.refundQuota()` | n/a | n/a | `GetBrevoUsage` card | n/a |
| Tenant connect / disconnect / quota reset | `IntegrationsService` + `AdminBrevoService.disconnectTenant` / `resetTodayQuota` | `POST /integrations/brevo/{connect,disconnect}` + `POST /admin/brevo/tenants/:tenantId/{disconnect,reset-quota}` | ✅ connect/disconnect at tenant settings | ✅ revoke + reset buttons (audited) | n/a |
| Daily quota tracking (UTC bucket) | `BrevoUsageService` | `GET /integrations/usage/brevo` | ✅ in tenant dashboard | ✅ `GlobalDailyLimit` in platform stats | n/a |
| Master-key bootstrap for tenants | `scripts/brevo-bootstrap-tenant.cjs` | CLI: `pnpm run brevo:bootstrap -- <tenantId>` / `--all` | n/a | n/a | n/a |
| Smoke test | `scripts/brevo-smoke.sh` | runs `validate → usage → test-send → usage after` | n/a | n/a | n/a |
| Platform-wide stats | `AdminBrevoService.platformStats()` | `GET /admin/brevo/platform-status` | n/a | ✅ Overview KPI cards | n/a |
| Usage series (30-day chart) | `AdminBrevoService.usageSeries()` | `GET /admin/brevo/usage-series` | n/a | ✅ `AreaChart` + `Sparkline` | n/a |
| Brevo account health probe | `AdminBrevoService.healthCheck()` | `GET /admin/brevo/health` | n/a | ✅ live probe + colored badge | n/a |
| **Tenant setup wizard (Phase-5)** | n/a | n/a | ✅ 5-step setup dialog + separate setup guide | n/a | n/a |
| **Toast notifications (Phase-5)** | n/a | n/a | ✅ success/error toasts with auto-dismiss | n/a | n/a |
| **Sender identity setup guidance (Phase-5)** | n/a | n/a | ✅ detailed instructions in setup wizard | n/a | n/a |

All eleven Brevo services (4 backend services + 2 providers + 1 factory + 4 admin-side modules) are wired in `integrations.module.ts`. **187 tests** pass across 15 suites (was 116 before — +71 across the four phases). Phase-5 is a frontend-only enhancement; no new backend tests required. All admin routes are `@Roles(SUPER_ADMIN, PLATFORM_ADMIN)`-guarded; the tenant dashboard also gates `/admin/brevo/*` with the new `useRequirePlatformAdmin` hook (defense-in-depth on top of the backend role guard).

---

## 2. Backend Architecture

### 2.1 Module Structure

```
src/modules/integrations/
├── integrations.module.ts              ← Registers all Brevo services + controllers
├── integrations.controller.ts          ← REST endpoints (tenant + admin)
├── integrations.service.ts             ← Tenant OAuth-style flows (Google); Brevo uses its own controller routes
├── dto/integration.dto.ts              ← ConnectGoogleDto (audience), ConnectBrevoDto
├── email/
│   ├── email-provider.factory.ts       ← Provider resolution (gmail vs brevo)
│   ├── gmail-email.provider.ts         ← Gmail email sending
│   └── brevo-email.provider.ts         ← Brevo provider (delegates to BrevoEmailService)
├── services/
│   ├── integration-credential.store.ts ← AES-256-GCM encrypted credential persistence
│   └── credential-store.interface.ts
├── google/                             ← (unrelated; listed for completeness)
└── brevo/
    ├── brevo-email.service.ts          ← Master-key fallback, sendEmail, sendBatch, identity cache
    ├── brevo-usage.service.ts          ← Daily quota: checkLimit + recordSend (+ checkLimitFor / recordSendBatch)
    ├── brevo-webhook.service.ts        ← HMAC-SHA256 verify, dedup, persist, hook into suppressions
    ├── brevo-suppression.service.ts    ← Stronger-reason upsert, batch filterSuppressed, aggregate, CRUD
    ├── admin-brevo.service.ts          ← Cross-tenant platform stats, series, disconnect, reset, events, health
    ├── admin-brevo.controller.ts       ← (lives in `integrations.controller.ts`; namespace `/admin/brevo/*`)
    └── __tests__/
        ├── brevo-email.service.spec.ts
        ├── brevo-webhook.service.spec.ts
        ├── admin-brevo.service.spec.ts
        └── brevo-suppression.service.spec.ts
```

### 2.2 Key Resolution Order

`BrevoEmailService.getApiKey(tenantId)` resolves in order:

1. **`IntegrationCredential(tenantId, BREVO)`** — per-tenant encrypted credential (`{apiKey}` blob).
2. **`BREVO_MASTER_API_KEY`** env var (decoded from base64 OR bare form).
3. **`null`** → `sendEmail` throws `BadRequestException` with a clear remediation message.

Cached in-memory for 5 minutes per tenant. `BrevoEmailService.invalidate(tenantId)` flushes the cache (called by the disconnect endpoint).

### 2.3 Per-Tenant Sender Identity

`BrevoEmailService.getTenantIdentity(tenantId)` resolves in order:

1. **Tenant table columns** — `tenants.brevoSenderEmail / brevoSenderName / brevoReplyToEmail`. Set via `PUT /integrations/brevo/sender`.
2. **Env defaults** — `EMAIL_FROM_ADDRESS`, `EMAIL_FROM_NAME`, `EMAIL_REPLY_TO`.

Source badge returned (`'tenant'` vs `'env'`) for UI display. 5-min TTL; cleared on `PUT/DELETE /integrations/brevo/sender`.

### 2.4 Mail Routing

`EmailProviderFactory.forSend(tenantId, preferred, requested)` (`src/modules/integrations/email/email-provider.factory.ts:23`):

| Condition | Provider |
|---|---|
| `agent.emailProvider = 'gmail'` AND tenant has Google connected | Gmail |
| `agent.emailProvider = 'brevo'` AND Brevo connectable | Brevo |
| Neither connected | `Error: No email provider available` |
| Brevo daily cap hit | `BadRequestException` from `BrevoUsageService.checkLimit` |

### 2.5 Suppression List (P3 → P4)

`BrevoSuppressionService.upsert` is **idempotent with a stronger-reason heuristic**:

| Rank | Reason | Authoritative behavior |
|---|---|---|
| 5 | `ADMIN_BLOCK` | Never downgraded |
| 4 | `SPAM_COMPLAINT` | Overrides `UNSUBSCRIBE`/`MANUAL`; preserves against `BOUNCE_HARD` only |
| 3 | `BOUNCE_HARD` | Overrides `UNSUBSCRIBE`/`MANUAL` |
| 2 | `UNSUBSCRIBE` | Self-suppression; ignored on admin actions against a stronger cause |
| 1 | `MANUAL` | Lowest; overwritten by anything |

`BrevoSuppressionService.filterSuppressed(tenantId, emails)` — one indexed `IN` query returns the subset. The `BrevoEmailService.sendBatch` loop splits recipients, only consumes quota for the sendable subset, and surfaces blocked recipients in `errors[]` with `suppressed: true`.

---

## 3. API Surface (29 endpoints)

### 3.1 Tenant routes (`@CurrentUser()`)

| Method | Path | Body / Result |
|---|---|---|
| `GET` | `/integrations/google/status` | existing |
| `GET` | `/integrations/google/platform-status` | existing (admin only) |
| `GET` | `/integrations/brevo/status` | `{status, scopes, agentCount, …}` |
| `POST` | `/integrations/brevo/connect` | `{apiKey}` |
| `POST` | `/integrations/brevo/disconnect` | `{success:true}` (also `invalidate()` cache) |
| `GET` | `/integrations/brevo/validate` | `{valid, source, account?, error?}` (5-min cached) |
| `POST` | `/integrations/brevo/test-send` | `{to, subject?, htmlContent?}` → `{success, messageId, source}` |
| `GET` | `/integrations/usage/brevo` | `{sentToday, dailyLimit, warningThreshold, isAtWarning, isAtLimit, remaining}` |
| `GET` | `/integrations/brevo/sender` | `{tenant: {…}, resolved: {senderEmail, senderName, replyToEmail, source}}` |
| `PUT` | `/integrations/brevo/sender` | `{brevoSenderEmail, brevoSenderName?, brevoReplyToEmail?}` |
| `DELETE` | `/integrations/brevo/sender` | clear per-tenant identity |
| `POST` | `/integrations/brevo/send-batch` | `{recipients[], subject, htmlContent, signature?, tags?}` |
| `GET` | `/integrations/brevo/events` | `{messageId?, limit?}` → filtered recent events for the tenant |
| `POST` | `/integrations/brevo/webhook` | **public**, HMAC-SHA256-verified when `BREVO_WEBHOOK_SECRET` is set |

### 3.2 Admin routes (`@Roles(SUPER_ADMIN, PLATFORM_ADMIN)`)

| Method | Path | Body / Result |
|---|---|---|
| `GET` | `/admin/brevo/platform-status` | see §4 |
| `GET` | `/admin/brevo/tenants` | per-tenant roll-up (§5) |
| `GET` | `/admin/brevo/usage-series` | 30-day daily totals + per-tenant breakdown |
| `GET` | `/admin/brevo/health` | master-key probe against `/v3/account` + webhook presence |
| `GET` | `/admin/brevo/events` | cross-tenant webhook events (filter: `tenantId, eventType, messageId, from, to, limit, offset`) |
| `GET` | `/admin/brevo/suppressions` | suppression list (filter: `email, reason, tenantId, limit, offset`) |
| `POST` | `/admin/brevo/suppressions` | `{email, reason, tenantId?, details?}` → `{success, created}` |
| `DELETE` | `/admin/brevo/suppressions/:id` | `{deleted}` (audited) |
| `POST` | `/admin/brevo/tenants/:tenantId/disconnect` | `{revoked, hadCredential, hadSenderIdentity}` (audited) |
| `POST` | `/admin/brevo/tenants/:tenantId/reset-quota` | `{reset, previousCount}` (audited) |

---

## 4. Admin Dashboard (`/admin/brevo`)

A 5-tab platform-admin console at `/admin/brevo/*`. Only `SUPER_ADMIN` / `PLATFORM_ADMIN` may visit (enforced both client-side via `useRequirePlatformAdmin` and server-side via `@Roles(...)`). Shell: `src/components/admin-brevo/AdminBrevoShell.tsx`.

| Tab | Path | Highlights |
|---|---|---|
| Overview | `/admin/brevo` | 4 KPI cards (Connected tenants · Sent today · Daily limit · Master key + secret), `AreaChart` 7-day trend, `Sparkline` summary + avg/peak, suppression quick-look card, live Brevo account health, top-5 tenants by today's quota, recent webhook events feed |
| Tenants | `/admin/brevo/tenants` | search + 4-state filter, animated `QuotaBar`, status badge, sender, last-updated, in-row **Reset quota** and **Disconnect** buttons. Both actions write `AuditLog` rows via `AuditService.log()`. |
| Events | `/admin/brevo/events` | tenant / event type / messageId filters, pagination, reason column |
| Suppressions | `/admin/brevo/suppressions` | 5-card aggregate ribbon (one per reason), filter by email / reason / tenant (incl. "global only"), inline add modal (`ADMIN_BLOCK` / `MANUAL` etc.), per-row remove |
| Settings | `/admin/brevo/settings` | Master-key / webhook-secret presence, global sender identity, Brevo account probe, webhook configuration notes, CLI quick-reference |

Shared primitives in `src/components/admin-brevo/BrevoAdminPrimitives.tsx`:
- `KpiCard` — animated motion entry, `tone` palette (neutral / good / warn / bad).
- `StatusBadge` — CONNECTED / MASTER / NOT_CONNECTED.
- `EventTypeBadge` — colored badge per `BrevoWebhookEventType`.
- `QuotaBar` — animated width transition with warning/limit thresholds.
- (Reused chart components: `AreaChart`, `Sparkline` from `src/components/charts/`.)

---

## 5. Data Model

### 5.1 `tenants` (additive columns)

| Column | Type | Notes |
|---|---|---|
| `brevoSenderEmail` | `TEXT` (nullable) | per-tenant override |
| `brevoSenderName` | `TEXT` (nullable) | display name |
| `brevoReplyToEmail` | `TEXT` (nullable) | reply-to |

### 5.2 `brevo_usage_counters` (existing — unchanged)

PK on `(tenantId, date)` UTC bucket. `sentCount` exposed via `GET /integrations/usage/brevo`.

### 5.3 `brevo_webhook_events` (new)

```
@@unique([externalId, eventType])   -- idempotent against Brevo retries
@@index([tenantId, receivedAt])
@@index([messageId])
@@index([eventType, receivedAt])
@@map("brevo_webhook_events")
```

`BrevoWebhookEventType` enum: `DELIVERED, OPEN, CLICK, BOUNCE_HARD, BOUNCE_SOFT, SPAM, UNSUBSCRIBE, BLOCKED, ERROR, REQUEST`.

### 5.4 `brevo_suppressions` (new in Phase-4)

```
@@unique([tenantId, email])          -- one row per (tenant | global, email)
@@index([email])
@@index([reason])
@@index([tenantId, reason, createdAt])
@@map("brevo_suppressions")
```

`BrevoSuppressionReason` enum: `BOUNCE_HARD, UNSUBSCRIBE, ADMIN_BLOCK, SPAM_COMPLAINT, MANUAL`.

---

## 6. Environment Variables

### 6.1 `.env.production` (Production)

```bash
EMAIL_PROVIDER=brevo
EMAIL_FROM_ADDRESS=hello@yourdomain.com         # MUST be a verified Brevo sender / domain
EMAIL_FROM_NAME=NeureCore
EMAIL_REPLY_TO=support@yourdomain.com

# Master API key — supports either form:
BREVO_MASTER_API_KEY=xkeysib-xxxxxxxxxxxxxxxxxxxxxxxxxxxx
# BREVO_API=eyJhcGlfa2V5IjoieGtleXNpYi0...    # base64 JSON, auto-decoded

BREVO_DAILY_LIMIT=300
BREVO_API_BASE_URL=https://api.brevo.com/v3
BREVO_WEBHOOK_SECRET=<from Brevo dashboard>
```

### 6.2 Dev `.env`

A separate Brevo workspace with a lower limit. Never commit real keys.

---

## 7. Tests

187/187 passing across 15 suites (was 116 before — **+71** across Phase-1 → Phase-4).

| Spec | Coverage |
|---|---|
| `config-env-loader.spec.ts` (12) | `decodeBrevoMasterKey`, BREVO_API → BREVO_MASTER_API_KEY normalization |
| `brevo-email.service.spec.ts` (15) | key resolution (master-null, tenant-preferred, master-fallback, cache, invalidate), sender/render/error mapping, sender identity, batch send |
| `brevo-webhook.service.spec.ts` (12) | HMAC-SHA256 timing-safe, body parse, event types, dedup (P2002), hard-bounce refund, suppression hook on bounce/unsub/spam |
| `admin-brevo.service.spec.ts` (15) | platform stats, tenant rows, usage series, disconnect, quota reset, events query, health probe (not-configured / 200 / 401 / network) |
| `brevo-suppression.service.spec.ts` (12) | upsert, stronger-reason heuristic, lowercasing, tenant/null rows, `isSuppressed`, `filterSuppressed`, `aggregate`, `remove` |
| `integrations.service.spec.ts` (+ existing) | unchanged |

Run: `pnpm run test:unit src/modules/integrations/brevo`

---

## 8. Change List (by phase)

### Phase-1 (core + master-key bootstrap)
- `src/config/env.loader.ts` — `BrevoConfig` type + `decodeBrevoMasterKey()` helper.
- `src/config/configuration.service.ts` — `getBrevo()` + surfaced in `getAll()`.
- `src/modules/integrations/brevo/brevo-email.service.ts` — rewritten with master-key fallback, 5-min caches, retry/error mapping.
- `src/modules/integrations/email/brevo-email.provider.ts` — wrapper over `BrevoEmailService`.
- `src/modules/integrations/integrations.controller.ts` — `brevo/{validate,test-send,events,sender/*,send-batch}`.
- `prisma/migrations/20260716_brevo_extensions/migration.sql` — tenant sender columns + webhook event table.
- `.env.production` + `.env.example` — `EMAIL_FROM_*`, `BREVO_DAILY_LIMIT`, `BREVO_API_BASE_URL`.
- `eslint.config.mjs` — added `__tests__` dirs to test-file override.

### Phase-2 (smoke + bootstrap)
- `backend/scripts/brevo-bootstrap-tenant.cjs` — AES-256-GCM seeds `IntegrationCredential` rows.
- `backend/scripts/brevo-smoke.sh` — 4-step curl smoke.
- Unit tests for Phase-1 components.

### Phase-3 (webhooks + bulk + per-tenant identity)
- `prisma/schema.prisma` — `BrevoWebhookEvent` + `BrevoWebhookEventType` enum.
- `src/modules/integrations/brevo/brevo-webhook.service.ts` — HMAC-SHA256 + dedup + suppression hook + hard-bounce quota refund.
- `BrevoEmailService.sendBatch` (≤ 50 recipients) + `BrevoUsageService.checkLimitFor/recordSendBatch`.
- `BREVO_BATCH_LIMIT` constant.
- Per-tenant identity resolver wired into both `sendEmail` and `sendBatch`.

### Phase-4 (admin dashboard + suppression list + guard)
- `prisma/schema.prisma` — `BrevoSuppression` model + `BrevoSuppressionReason` enum.
- `prisma/migrations/20260716_brevo_suppressions/migration.sql` — additive.
- `src/modules/integrations/brevo/brevo-suppression.service.ts` — full CRUD + heuristic.
- `src/modules/integrations/brevo/admin-brevo.service.ts` — `platformStats` + `tenantRows` + `usageSeries` + `healthCheck` + `disconnectTenant` + `resetTodayQuota` + `listEvents`.
- `src/modules/integrations/integrations.controller.ts` — 7 admin endpoints (`/admin/brevo/*`) all `@Roles(SUPER_ADMIN, PLATFORM_ADMIN)`, audited on writes.
- `src/auth/hooks/useRequirePlatformAdmin.ts` — client-side guard.
- `src/components/admin-brevo/{AdminBrevoShell,BrevoAdminPrimitives}.tsx`.
- `src/app/admin/brevo/{page,tenants/page,events/page,settings/page,suppressions/page}.tsx`.
- `src/types/adminBrevo.types.ts` — all DTOs.
- `src/services/adminBrevo.service.ts` — axios client with full endpoint coverage.
- `src/hooks/useAdminBrevo.ts` — overview hook + events hook.
- `src/components/sidebar/navigation.config.ts` — new "Integrations" group with `Brevo Email (✉)` entry.

### Phase-5 (tenant UI enhanced setup experience — 2026-07-17)
- `frontend-tenant/src/app/settings/integrations/page.tsx` — `BrevoIntegrationCard` completely redesigned:
  - **5-step setup wizard** — Create account → Get API key → Verify domain → Create sender → Connect
  - **Comprehensive setup guide dialog** — Accessible anytime via "Setup Guide" button, includes:
    - Why domain verification matters (spam prevention)
    - How to create sender identity (From Name, From Email, Reply-To)
    - Important notes on daily limits, bounces, production recommendations
  - **Toast notifications** — Auto-dismissing success/error toasts (4s) replacing inline banners
  - **API key validation** — Loading state during connection with clear error messages
  - **"What this does" explanation** — Descriptive text explaining Brevo's purpose for AI agents
  - **Usage display** — Shows daily email limit badge when connected
  - **Disconnect confirmation** — Warns about impact on scheduled emails

---

## 9. Operational Runbook

### 9.1 First-time activation

```bash
# 1. Apply migrations
cd backend && pnpm prisma migrate deploy

# 2. Configure env (see §6.1)
# 3. In Brevo dashboard: verify sender domain + DNS (SPF/DKIM/DMARC)
# 4. Register Brevo webhook:
#    URL: https://<host>/api/v1/integrations/brevo/webhook
#    Events: delivered, open, click, hardBounce, softBounce, spam,
#            unsubscribe, blocked, error, request
#    Signing secret → BREVO_WEBHOOK_SECRET

# 5. Bootstrap existing tenants (optional — master key works without this)
cd backend && pnpm run brevo:bootstrap -- --all   # or <tenantId>
```

### 9.2 Smoke test (single command)

```bash
bash scripts/brevo-smoke.sh http://localhost:3000/api/v1 \
  "Bearer $(curl -s .../auth/login ...)" you@yourdomain.com
```

### 9.3 Per-tenant sender identity

```bash
curl -X PUT -H 'Authorization: Bearer <token>' -H 'Content-Type: application/json' \
  -d '{"brevoSenderEmail":"sales@acme.com","brevoSenderName":"Acme Sales","brevoReplyToEmail":"reply@acme.com"}' \
  http://localhost:3000/api/v1/integrations/brevo/sender
```

### 9.4 Disabled-webhook (verification off)

If `BREVO_WEBHOOK_SECRET` is empty, `verifySignature` returns `true` after a `WARN` log. This is dev-only; production must set the secret.

---

## 10. Pending Work & Future Enhancements

### 10.1 Pending — should be done before next release
- **Outbound-message map** — `BrevoWebhookEvent.messageId` is opportunistic; a real `brevo_outbound_messages` table (one row per send with `tenantId`) is needed to back-resolve tenant context 100 % accurately for cross-tenant analytics.
- **Rate-limit telemetry** — `BrevoUsageService` tracks daily count; per-hour rolling window and per-agent quotas not yet implemented.
- **Hard-bounce alert** — admin dashboard highlights tenancies with ≥ 5 % bounce rate over last 50 sends (today: only raw count surfaces; alerting not wired).
- **Sender-domain verification status** — Brevo account should expose the verified sender-domains list at `/admin/brevo/settings`. Currently only the global `EMAIL_FROM_ADDRESS` is shown.

### 10.2 Future enhancements — not on the critical path
- **Per-template analytics** — open / click / conversion funnel grouped by Brevo `templateId` (requires storing template IDs from sends).
- **SMTP fallback path** — backend already has `nodemailer`; an `email.provider.ts` factory switch could fall back to Brevo-SMTP (port 587) when the REST API fails.
- **Bulk-send queue** — `sendBatch` is synchronous. For lists > 50, queue via BullMQ worker that retries with backoff.
- **Multi-region Brevo** — currently single `BREVO_API_BASE_URL`. A region-aware resolver (DE / US) per tenant would lower latency for global tenants.
- **Idempotency keys on `sendEmail`** — accept an `Idempotency-Key` header and reuse the prior `messageId` within a TTL.
- **Marketing campaigns** — Brevo's `/v3/emailCampaigns` endpoint for outbound campaign sends (vs transactional). Out of scope today.
- **Inbound route** — Brevo inbound webhook → create Hermes task. Currently outbound only.
- **List-unsubscribe header (RFC 8058)** — Brevo's auto-generated list-unsubscribe URL is forwarded by the SMTP setup; `One-Click` header injection is *not* currently added in our send path.

### 10.3 Known limitations
- **Spam complaint trigger** — Brevo's `spam` event triggers a `SPAM_COMPLAINT` suppression, but the dashboard only surfaces total + per-reason aggregate. A reactive admin warning for > 3 spam complaints in 24h is not yet built.
- **No manual `expiresAt` UI** — the schema supports `expiresAt` for time-bound suppressions (e.g. "blocklist this for 30 days") but the admin UI just persists the column with `null`.
- **Webhook signature scope** — Brevo's `signature` query fallback is honored; in production behind a CDN that strips `X-Brevo-Signature` headers, switch to `?signature=` and verify with HMAC-SHA256.

---

## 11. File Reference Index

### 11.1 Backend (new since Phase-1)

| Path | Lines (approx) | Purpose |
|---|---|---|
| `src/modules/integrations/brevo/brevo-email.service.ts` | 555 | core transactional + batch + identity cache |
| `src/modules/integrations/brevo/brevo-usage.service.ts` | 60 | daily-quota tracking + batch support |
| `src/modules/integrations/brevo/brevo-webhook.service.ts` | 245 | HMAC verify + event persistence + suppression hook |
| `src/modules/integrations/brevo/brevo-suppression.service.ts` | 200 | CRUD + heuristic + aggregate |
| `src/modules/integrations/brevo/admin-brevo.service.ts` | 460 | cross-tenant aggregations |
| `prisma/migrations/20260716_brevo_extensions/migration.sql` | 75 | additive Phase-3 migration |
| `prisma/migrations/20260716_brevo_suppressions/migration.sql` | 50 | additive Phase-4 migration |
| `scripts/brevo-bootstrap-tenant.cjs` | 165 | bootstrap helper |
| `scripts/brevo-smoke.sh` | 50 | smoke harness |

### 11.2 Frontend admin (new since Phase-4)

| Path | Purpose |
|---|---|
| `src/auth/hooks/useRequirePlatformAdmin.ts` | client-side role guard |
| `src/components/admin-brevo/AdminBrevoShell.tsx` | shared shell + 5-tab nav |
| `src/components/admin-brevo/BrevoAdminPrimitives.tsx` | KpiCard, StatusBadge, EventTypeBadge, QuotaBar |
| `src/app/admin/brevo/page.tsx` | Overview |
| `src/app/admin/brevo/tenants/page.tsx` | Tenant table |
| `src/app/admin/brevo/events/page.tsx` | Webhook event explorer |
| `src/app/admin/brevo/suppressions/page.tsx` | Suppression explorer |
| `src/app/admin/brevo/settings/page.tsx` | Configuration display |
| `src/services/adminBrevo.service.ts` | axios client (8 endpoints) |
| `src/hooks/useAdminBrevo.ts` | overview + events hooks |
| `src/types/adminBrevo.types.ts` | all DTOs |

### 11.3 Frontend tenant (Phase-5)

| Path | Purpose |
|---|---|
| `frontend-tenant/src/app/settings/integrations/page.tsx` | Enhanced `BrevoIntegrationCard` with setup wizard, guide, toasts |
