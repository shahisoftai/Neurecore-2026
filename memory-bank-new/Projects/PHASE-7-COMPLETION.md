# Phase 7 — Client Portal: Completion Report

**Date:** 2026-07-09
**Goal:** External-facing view. Clients see their projects and can interact with deliverables.

---

## What Was Built

### Backend

#### Phase 7.1 — Scoped JWT (projectId-scoped tokens)

- **`JwtPayload.projectId?: string`** — optional field added to `JwtPayload` interface for project-scoped portal access
- **`PortalAuthGuard`** (`guards/portal-auth.guard.ts`) — custom NestJS guard that:
  - Extracts `Authorization: Portal <projectId:contactId:rawToken>` header
  - Validates token against `CustomerContact.portalToken` (SHA-256 hash comparison)
  - Checks token expiry (`portalTokenExpiresAt`)
  - Attaches `PortalTokenPayload` to the request for downstream use
- **`PortalService.requestAccess()`** — magic-link style token generation:
  - Looks up `CustomerContact` by email + project membership
  - Generates `projectId:contactId:randomToken` (raw token returned directly for API clients; in production would email the link)
  - Stores SHA-256 hash of token in `CustomerContact.portalToken`
- **`PortalService.validateToken()`** — validates and returns `PortalTokenPayload`

#### Phase 7.2 — Document Upload (client → project)

- **Migration** (`20260709_phase7_client_portal/migration.sql`):
  - `project_documents` table: `id/projectId/name/description/fileUrl/fileKey/fileSize/mimeType/visibility/uploadedBy/createdAt/updatedAt`
  - `client_facing` boolean on `deliverables` table
  - `portalToken` + `portalTokenExpiresAt` on `customer_contacts`
- **`ProjectDocument` model** in Prisma schema (Phase 7 section)
- **`DOCUMENT_UPLOAD`** constant in `storage.interface.ts` — 20MB limit, PDF/Office/images/text
- **`PortalService.uploadDocument()`** — tenant-scoped upload with `visibility` (CLIENT/INTERNAL)
- **`PortalService.listDocuments()`** — returns CLIENT-visible documents for a project
- **`GET /portal/projects/:projectId/documents`** — list endpoint
- **`POST /portal/projects/:projectId/documents`** — upload endpoint with `FileInterceptor`

#### Phase 7.3 — Client-Facing Approval

- **`Deliverable.clientFacing` boolean** — marks deliverables visible to clients (Phase 7 migration)
- **`PortalService.approveDeliverable()`** — client approval flow:
  - Verifies project access for contact
  - Validates deliverable is `clientFacing=true` and `status=IN_REVIEW`
  - Updates status to `APPROVED`
  - Creates `AuditLog` entry (not `ExecutionLog` — `ExecutionLog` is for agent/task cost tracking)
- **`POST /portal/projects/:projectId/deliverables/:deliverableId/approve`** — approval endpoint

### Full Portal API Surface

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/portal/request-access` | None | Request portal token (magic link flow) |
| POST | `/portal/validate` | None | Validate portal token |
| GET | `/portal/projects/:projectId` | Portal | Read-only project details |
| GET | `/portal/projects/:projectId/documents` | Portal | List CLIENT-visible documents |
| POST | `/portal/projects/:projectId/documents` | Portal | Upload a document |
| POST | `/portal/projects/:projectId/deliverables/:id/approve` | Portal | Client approves deliverable |

### Module Structure

```
portal/
├── interfaces/
│   └── portal.interface.ts         # Types + IPortalRepository
├── dto/
│   └── portal.dto.ts               # All request/response DTOs
├── repositories/
│   └── prisma-portal.repository.ts # Tenant-scoped queries
├── services/
│   └── portal.service.ts           # Business logic + PORTAL_REPOSITORY token
├── guards/
│   └── portal-auth.guard.ts        # Token validation guard
├── controllers/
│   └── portal.controller.ts        # REST endpoints
└── portal.module.ts
```

---

## Key Design Decisions

1. **Token format: `projectId:contactId:rawToken`** — separating projectId in the token itself allows O(1) project mismatch detection without a DB lookup. Raw token is stored as SHA-256 hash.

2. **`AuditLog` not `ExecutionLog` for approvals** — `ExecutionLog` is for agent/task cost tracking (has `costUsd`, `tokensUsed`, `evaluationScore`). Client approval is an audit event, so `AuditLog` is appropriate.

3. **`DocumentVisibility` handled at app level** — Prisma schema uses `String` for visibility, app-level constant `DOCUMENT_VISIBILITY = { CLIENT, INTERNAL }` enforces the type.

4. **`clientFacing` boolean on `Deliverable`** — simple flag rather than a separate relation. Clients see deliverables where `clientFacing=true`.

5. **`memoryStorage()` for portal uploads** — no local disk persistence in this stub; `fileUrl` is returned as a logical path. Production would swap `LocalDiskStorage` or add S3/GCS implementation.

---

## Verification

- Backend `tsc --noEmit` — **PASS** (0 errors)
- Backend `npm run build` — **PASS** (nest build completed)
- Frontend `tsc --noEmit` — **PASS** (0 errors)
- Frontend `npm run build` — **PASS**

---

## Anti-Patterns Followed

- **Never expose JWT secret to portal tokens** — portal tokens use a separate raw-token-with-hash mechanism, not JWTs
- **Append-only document storage** — documents are never updated, only created/deleted
- **Client approval scoped to own project** — every operation verifies `contactId` is associated with `projectId` via `CustomerContact.customer.projects`
- **Deliverable approval restricted** — only `clientFacing=true` AND `status=IN_REVIEW` deliverables can be approved by clients
