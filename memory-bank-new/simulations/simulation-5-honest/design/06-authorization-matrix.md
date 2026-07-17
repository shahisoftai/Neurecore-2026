# Item 6: Authorization Matrix

This document specifies, for each entity and each role, who can create, read, update, or delete. Roles follow the existing `UserRole` enum (`SUPER_ADMIN`, `PLATFORM_ADMIN`, `OWNER`, `ADMIN`, `USER`, `AUDITOR`). **The `SYSTEM` role is not added**; service workloads use the `ServiceIdentity` model instead (see revision 1).

The simulation framework is a tenant feature: every authorization check is tenant-scoped, and cross-tenant access is rejected (404, not 403).

## 1. Role capabilities (tenant-internal)

| Role | Can do in the simulation framework |
|---|---|
| `OWNER` | Create a simulation, run any day, configure engine, finalize, delete the run |
| `ADMIN` | Create a simulation, run any day, finalize, delete the run; create and revoke `ServiceIdentity` rows |
| `AUDITOR` | Read everything, including simulation artifacts; can post auditor challenges; can approve audit-related approvals |
| `USER` | Read simulation artifacts (with the badge); can post messages in debate/challenge threads only as a "Human reviewer" participant; cannot create decisions or run days |
| `ServiceIdentity` (not a User role — its own first-class concept) | Acts as a workload; can call state-changing engine endpoints when the service token has the required scope. Cannot create or delete simulations on its own; needs a human-owned `OWNER`/`ADMIN` to call `POST /simulations`. |

Platform roles (`SUPER_ADMIN`, `PLATFORM_ADMIN`) can read any simulation in any tenant but cannot create or run simulations on behalf of a tenant.

## 2. Per-endpoint authorization

| Endpoint | OWNER | ADMIN | AUDITOR | USER | ServiceIdentity | Notes |
|---|---|---|---|---|---|---|
| `POST /api/v1/simulations` | ✅ | ✅ | ❌ | ❌ | ❌ | Human only |
| `GET /api/v1/simulations` (list) | ✅ | ✅ | ✅ (own) | ✅ (own) | ❌ | Users see their tenant's runs only |
| `GET /api/v1/simulations/:id` | ✅ | ✅ | ✅ | ✅ (own) | ✅ (scope=simulation-engine) | Service identities can read their own run |
| `POST /api/v1/simulations/:id/days/:day/run` | ✅ | ✅ | ❌ | ❌ | ✅ (scope=simulation-engine) | The framework's engine calls |
| `GET /api/v1/simulations/:id/days/:day` | ✅ | ✅ | ✅ | ✅ (own) | ✅ (scope=simulation-engine) | |
| `POST /api/v1/simulations/:id/finalize` | ✅ | ✅ | ❌ | ❌ | ❌ | Human only (intentional) |
| `GET /api/v1/simulations/:id/timeline-events` | ✅ | ✅ | ✅ | ✅ (own) | ✅ (scope=simulation-engine) | |
| `POST /api/v1/simulations/:id/decisions` | ❌ (via API) | ❌ (via API) | ❌ | ❌ | ✅ (scope=simulation-engine) | Only the Decision Engine creates decisions |
| `GET /api/v1/simulations/:id/decisions` | ✅ | ✅ | ✅ | ✅ (own) | ✅ (scope=simulation-engine) | |
| `POST /api/v1/simulations/:id/decisions/:did/debate` | ❌ (via API) | ❌ (via API) | ❌ | ❌ | ✅ (scope=simulation-engine) | Only the Debate Engine |
| `POST /api/v1/simulations/:id/debates/:tid/messages` | engine (system) + USER (as human reviewer) | same | same | same | ✅ (scope=simulation-engine) | Agents post as `participantType='AGENT'`, users as `'USER'`, service identities as `'SERVICE_IDENTITY'` |
| `POST /api/v1/simulations/:id/decisions/:did/devil-advocate` | ❌ (via API) | ❌ (via API) | ❌ | ❌ | ✅ (scope=simulation-engine) | Only the Devil's Advocate Engine |
| `POST /api/v1/simulations/:id/challenges/:tid/messages` | ❌ (via API) | ❌ (via API) | ❌ | ❌ | ✅ (scope=simulation-engine) | Devil's Advocate is an engine |
| `POST /api/v1/simulations/:id/decisions/:did/approval` | ❌ (via API) | ❌ (via API) | ❌ | ❌ | ✅ (scope=simulation-engine) | Only the Approval Engine |
| `POST /api/v1/simulations/:id/approvals/:aid/approve` | role-must-match-requiredRole | same | if requiredRole=AUDITOR | ❌ | ❌ | Real human action; service identities do not approve |
| `POST /api/v1/simulations/:id/approvals/:aid/reject` | role-must-match-requiredRole | same | if requiredRole=AUDITOR | ❌ | ❌ | Real human action |
| `POST /api/v1/simulations/:id/decisions/:did/tasks` | ❌ (via API) | ❌ (via API) | ❌ | ❌ | ✅ (scope=simulation-engine) | Only the Task Engine |
| `POST /api/v1/simulations/:id/tasks/:tid/complete` | assignee OR OWNER/ADMIN | same | ❌ | assignee OR OWNER/ADMIN | ✅ (scope=simulation-engine, if assignee) | Real action |
| `POST /api/v1/simulations/:id/decisions/:did/auditor-review` | ❌ (via API) | ❌ (via API) | ❌ (must be impartial) | ❌ (via API) | ✅ (scope=simulation-engine) | Auditor Engine runs the challenge; humans are the responders |
| `GET /api/v1/simulations/:id/scores` | ✅ | ✅ | ✅ | ✅ (own) | ✅ (scope=simulation-engine) | |
| `GET /api/v1/simulations/:id/records` | ✅ | ✅ | ✅ | ✅ (own) | ✅ (scope=simulation-engine) | |
| `POST /api/v1/service-identities` | ✅ | ✅ | ❌ | ❌ | ❌ | |
| `POST /api/v1/service-identities/:id/tokens` | ✅ | ✅ | ❌ | ❌ | ❌ | Only the human who owns the identity issues tokens |
| `GET /api/v1/service-identities` | ✅ | ✅ | ❌ | ❌ | ❌ | |
| `POST /api/v1/service-identities/:id/revoke` | ✅ | ✅ | ❌ | ❌ | ❌ | |

## 3. Service identity and token flow

A `ServiceIdentity` is created by an `OWNER` or `ADMIN` via `POST /api/v1/service-identities`. The creator supplies a name and a list of scopes. The framework then issues short-lived tokens via `POST /api/v1/service-identities/:id/tokens`. The plaintext token is returned **once**; the server stores only the SHA-256 hash.

Every request the framework makes is:

```
POST /api/v1/simulations/.../...
Authorization: Bearer <service-token>
X-Idempotency-Key: <key>
```

The new `ServiceIdentityGuard` (a NestJS guard) verifies the token:
1. The token hash matches a `ServiceToken` row.
2. The token is not expired (`expiresAt > now`).
3. The token is not revoked (`revokedAt IS NULL`).
4. The token's `scopes` array contains the scope required by the endpoint.
5. The token's `tenantId` matches the caller's `tenantId` (from the path or the body).

If any check fails, the guard returns 403 with `SERVICE_IDENTITY_SCOPE_INSUFFICIENT` (or `UNAUTHORIZED` if the token is invalid).

The `RolesGuard` is **bypassed** for service-identity calls. The `ActivityEvent` records the call with `actorType: 'SERVICE_IDENTITY'` and `actorId: <serviceIdentityId>`.

## 4. Tenant isolation

Every endpoint enforces:
- The path's `simulationId` resolves to a `Project` whose `tenantId` matches the caller's `tenantId`. If not, return 404.
- The caller's `tenantId` is taken from the JWT (for human users) or the service token (for service identities), not from the request body or path.

Cross-tenant attempts are logged with a `security.cross_tenant_attempt` audit event.

## 5. Audit logging

Every state-changing call writes an `ActivityEvent` record with:
- `actorType`: `USER`, `AGENT`, or `SERVICE_IDENTITY`
- `actorId`: the userId, agentId, or serviceIdentityId
- `action`: e.g. `simulation.day.run`, `simulation.decision.create`, `service-identity.token.issue`
- `subjectType`, `subjectId`
- `metadata`: `{ simulationId, day, engine, idempotencyKey }`
- `tenantId`, `ip`, `userAgent`

This is a production audit log; it is not a simulation-only log. The same `ActivityEvent` format is used for any tenant operation.

## 6. Agent-runtime authorization

The agent runtime is invoked with a service-identity token. The runtime checks that:
- The target agent belongs to the same tenant.
- The calling service identity has `scope='simulation-engine'`.
- The agent is enabled (not deprecated, not suspended).
- The structured output schema is in an allowlist (the engine is not allowed to ask an agent for any JSON shape; only a fixed set of shapes is allowed).

If any check fails, the runtime returns 403 and the day-run records the failure.
