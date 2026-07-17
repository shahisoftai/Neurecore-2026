# Item 7: Idempotency Strategy

This document defines the idempotency rules for every state-changing operation in the simulation framework. The same rules apply to any future client (webhooks, integrations, billing).

## 1. Goals

- Calling the same operation twice with the same idempotency key never produces duplicate side effects.
- Calling the same operation twice with the same key but a different payload is detected and rejected.
- The original response is preserved and served on replay so the client can detect the replay.
- The TTL is long enough for retries (24 hours) and short enough that the table does not grow without bound.

## 2. Key format

The client supplies an `Idempotency-Key` header. Recommended shape:

```
<simulationId-URI>:<step>
```

Where `<simulationId-URI>` is the URI from `04-simulation-tagging-rules.md` §1 (e.g. `sim://2026/07/17/neurocore/sim5/000001`) and `<step>` is a step within the run.

**For a full day-run:**
- `sim://2026/07/17/neurocore/sim5/000001:day-1`

**For per-engine operations within a day (the framework's internal calls):**
- `sim://2026/07/17/neurocore/sim5/000001:day-1:reality`
- `sim://2026/07/17/neurocore/sim5/000001:day-1:decision`
- `sim://2026/07/17/neurocore/sim5/000001:day-1:debate:<debateThreadId>`
- `sim://2026/07/17/neurocore/sim5/000001:day-1:devil-advocate:<threadId>`
- `sim://2026/07/17/neurocore/sim5/000001:day-1:approval:<approvalId>`
- `sim://2026/07/17/neurocore/sim5/000001:day-1:task:<taskId>`
- `sim://2026/07/17/neurocore/sim5/000001:day-1:auditor:<threadId>`

The key is a free-form string. The format is a recommendation, not a requirement. The uniqueness constraint is `@@unique([tenantId, key])`. URI-encoding is the caller's responsibility; the server treats the key as opaque.

## 3. Server flow

For every state-changing endpoint:

1. Read `Idempotency-Key` from the request header. If absent:
   - If the endpoint is `POST /api/v1/simulations`, the key is implicitly `<computedSimulationIdURI>:create` and we generate it.
   - For day-run and child engine endpoints, the key is required. Return 400 `IDEMPOTENCY_KEY_REQUIRED` if missing.
2. Look up `IdempotencyRecord` by `(tenantId, key)`.
3. If found:
   a. If `status='IN_FLIGHT'`: another worker is processing this key. Return 409 `IDEMPOTENCY_IN_FLIGHT` (rare in single-worker mode, common in distributed mode).
   b. If `status='COMPLETED'`: compare `requestHash` to the request body's hash. If they match, return the original response with `Idempotency-Replayed: true`. If they differ, return 422 `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
   c. If `status='FAILED'`: the original attempt failed. The client may retry with the same key only if the request body is identical; if it is, the server retries the operation; if it differs, return 422.
4. If not found: create a new `IdempotencyRecord` with `status='IN_FLIGHT'`. Process the request. On success, update the record to `status='COMPLETED'` with the response. On failure, update to `status='FAILED'` with the error response.

The creation of the `IdempotencyRecord` is itself an atomic upsert:

```sql
INSERT INTO idempotency_records (id, tenant_id, key, request_path, request_hash, status, expires_at)
VALUES (...)
ON CONFLICT (tenant_id, key) DO NOTHING
RETURNING id;
```

If `RETURNING id` is null, another process won the race; we then re-read the record and apply the lookup logic above. This avoids two processes both doing the operation.

## 4. Request hashing

The `requestHash` is `sha256(canonicalRequestBody)` where `canonicalRequestBody` is the JSON body with:
- Object keys sorted lexicographically at every level.
- No insignificant whitespace.
- UTF-8 encoded.

The hash is stored as hex.

The path is also stored. Two requests with the same key but different paths are rejected (the key should be unique per operation).

## 5. Response storage

The response is stored as JSON in `IdempotencyRecord.responseBody`. The HTTP status is stored in `responseStatus`. If the response body is larger than 1 MB, only the first 256 KB are stored and the `metadata.truncated=true` flag is set. (For simulation day-runs the response is small; this is just a safety net.)

The server also stores a `responseChecksum = sha256(canonicalResponseBody)`. On every replay, the server computes the checksum of the stored response and returns 500 `RESPONSE_CORRUPTED` if it does not match. This protects against storage corruption (a corrupted row would otherwise return a wrong response with `replayed: true`).

## 6. Replay semantics

On a successful replay:
- HTTP status matches the original.
- Response body matches the original (the server verifies the `responseChecksum` first).
- Response header `Idempotency-Replayed: true`.
- Response header `Idempotency-Original-At: <iso timestamp>`.
- Response header `Idempotency-Attempt: <attemptCount>` so the client knows how many retries the original took.
- Response body adds a `replayed: true` field at the top level for client convenience; the canonical signal is the header.

## 6.1 Lifecycle fields (revised)

The new lifecycle fields on `IdempotencyRecord` make debugging easier:

- `startedAt` / `completedAt` make the duration explicit. Useful for "why did this take 30 seconds" and for the sweeper that finds `IN_FLIGHT` records that are stuck.
- `attemptCount` increments on each retry. A client retrying 5 times produces an `attemptCount=5` record. Useful for "this client keeps retrying, is something wrong?"
- `lastErrorCode` and `lastErrorMessage` are populated when the original attempt failed (`status='FAILED'`). Useful for "I retried with the same key, why is it still failing?".

A sweeper job runs every 5 minutes and finds `IN_FLIGHT` records older than 5 minutes. For each, it checks whether the underlying side effects are present (e.g. for a day-run, whether the expected `TimelineEvent` rows were created). If yes, it transitions the record to `COMPLETED` and stores the response. If no, it transitions to `FAILED`. This is best-effort recovery; the framework's day-run is reentrant, so a client retry can complete the day.

## 7. TTL and cleanup

Default TTL: 24 hours. A nightly job deletes records older than 24 hours.

For simulation runs, a longer TTL (90 days, matching the simulation retention) is set if `retentionDays > 1`. The simulation framework supplies the TTL when creating the record. After the simulation is deleted (retention period elapsed), the `IdempotencyRecord` rows are deleted in the same operation.

## 8. Failure recovery

If the server crashes mid-operation, the `IdempotencyRecord` is left in `IN_FLIGHT` status. A background sweeper finds records older than 5 minutes in `IN_FLIGHT` status and:
- If the underlying operation completed (we can detect this by looking for the side effects), mark the record `COMPLETED` and store the response.
- If the operation did not complete, mark the record `FAILED` and allow the client to retry.

This is "best effort" recovery. The simulation framework's day-run is designed to be reentrant: if the framework crashes mid-day, the next call to `POST /simulations/:id/days/:day/run` (with the same key) finds the partial work and either completes it or rolls it back. Rollback is implemented by tagging all created records with a `correlationId` that the day-run knows to delete if the day does not complete.

## 9. Relationship to the deterministic seed

The day-run is also deterministic by seed. If the client supplies the same seed, the same RNG state, and the same `expectedRngState`, the day-run produces the same outcomes. This is **not** a substitute for idempotency:

- The same seed + the same key produces the same result and the same IdempotencyRecord.
- The same seed + a different key starts a new day-run that happens to be deterministic.
- A different seed always starts a new day-run, with the engine recording the seed change as a "seed reset" event in the control thread.

## 10. API surface

`Idempotency-Key` is a request header on every state-changing endpoint. The response headers are:

| Header | Value |
|---|---|
| `Idempotency-Replayed` | `true` on replay, omitted on first call |
| `Idempotency-Original-At` | ISO 8601 timestamp of the original completion |
| `Idempotency-Key` | Echoed back for client convenience |

The response body for a successful call includes the same shape as the first call, with `replayed: true` added at the top level for client convenience.

## 11. Tests

The acceptance test (Item 10) includes:
- Calling day-run twice with the same key produces exactly one set of records; the second response has `replayed: true` and identical body.
- Calling day-run twice with the same key but a different `expectedRngState` returns 422 `IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD`.
- Calling day-run twice with different keys (but the same seed) starts two independent runs, both with the same outcomes (because the seed is deterministic).
- A 24h-old `IdempotencyRecord` is deleted by the cleanup job.
