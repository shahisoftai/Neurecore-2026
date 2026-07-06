# Google Services Integration — Full Audit

## 1. Overview

NeureCore integrates with Google Workspace via OAuth 2.0. The integration is **tenant-scoped**: the tenant admin connects their Google Workspace account, and the system stores encrypted OAuth credentials per-tenant in `IntegrationCredential` table. All subsequent Google API calls use the tenant's access token.

**Requested OAuth Scopes** (all-or-nothing, single consent screen):
- `gmail.readonly` — Read inbox
- `gmail.send` — Send email
- `drive` — Full Drive access (create/read/update/delete files)
- `calendar` — Read/write calendar events
- `spreadsheets` — Read/write Google Sheets

**Currently Implemented Services:**
| Service | Backend | Tenant UI | Admin UI | Agent Tools |
|---------|---------|-----------|----------|-------------|
| Gmail | ✅ `GoogleGmailService` | ✅ Inbox UI + Compose page | ❌ None | ✅ `EmailTool` |
| Google Drive | ✅ `GoogleDriveService` | ✅ Folder tree view | ❌ None | ✅ `DocumentsTool`, `ReportsTool`, `ContextTool` |
| Calendar | ✅ `GoogleCalendarService` | ❌ No dedicated page | ❌ None | ❌ No tool wrapper |
| Google Sheets | ❌ No implementation | ❌ Only scope badge | ❌ None | ❌ None |
| Google Sign-In | ✅ `auth.service.googleSignIn()` | ✅ Login page | ❌ None | N/A |

---

## 2. Backend Architecture

### 2.1 Module Structure

```
src/modules/integrations/
├── integrations.module.ts              ← Registers all Google services + controllers
├── integrations.controller.ts          ← REST endpoints
├── integrations.service.ts             ← OAuth authorization/callback/disconnect logic
├── dto/integration.dto.ts              ← ConnectGoogleDto
├── services/
│   ├── integration-credential.store.ts ← AES-256-GCM encrypted credential persistence
│   └── credential-store.interface.ts   ← Abstraction interface
├── email/
│   ├── email-provider.factory.ts       ← Provider resolution (gmail vs brevo)
│   └── gmail-email.provider.ts         ← Gmail email sending via API
└── google/
    ├── google-auth.client.ts           ← OAuth2 token lifecycle + auto-refresh
    ├── google-drive.service.ts         ← Drive API wrapper (files, folders, agent setup)
    ├── drive-service.interface.ts      ← IDriveService interface
    ├── drive-cleanup.service.ts        ← Scheduler: cleanup terminated agent Drive folders
    ├── google-gmail.service.ts         ← Gmail API wrapper (inbox, send, labels)
    ├── google-calendar.service.ts      ← Calendar API wrapper (CRUD events)
    └── gmail-rate-limiter.ts           ← Rate limiting with retry logic
```

### 2.2 Database Schema (Prisma)

**`enum IntegrationProvider`** (line 1666):
```prisma
GOOGLE
BREVO
SLACK
MICROSOFT
```

**`model IntegrationCredential`** (line 1680):
- `tenantId` + `provider` = unique
- `encryptedCredentials` — AES-256-GCM encrypted blob (google-auth.client.ts stores `{ accessToken, refreshToken, expiryDate, scopes }`)
- `scopes`, `expiresAt`, `state`, `metadata`

**`model Tenant`** (line 315):
- `googleDriveRootFolderId` (String?) — ID of the "NeureCore" root folder in Drive
- `googleCalendarId` (String?) — ID of the tenant's primary calendar

**`model Agent`** (line 654):
- `googleDriveFolderId` (String?) — ID of the agent's dedicated Drive folder
- `emailAlias` (String?) — Sender email alias (e.g. `support@company.com`)
- `emailProvider` (String?, default `"brevo"`) — `"gmail" | "brevo"`
- `emailDisplayName` (String?)
- `emailSignature` (String?)

### 2.3 REST API Endpoints

**OAuth Flow:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/integrations` | List all connected providers |
| `GET` | `/integrations/google/status` | Connection status + granted scopes |
| `POST` | `/integrations/google/authorize` | Initiate OAuth — returns Google auth URL |
| `GET` | `/integrations/google/callback` | OAuth callback (public, redirects to tenant UI) |
| `POST` | `/integrations/google/disconnect` | Revoke + delete credentials |
| `GET` | `/integrations/google/drive-folders` | Root Drive tree (nested folder view) |

**Gmail:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/integrations/gmail/inbox` | List inbox messages |
| `GET` | `/integrations/gmail/messages/:id` | Get single message metadata |
| `GET` | `/integrations/gmail/messages/:id/body` | Get message body (plain text + HTML) |
| `POST` | `/integrations/gmail/send` | Send email via Gmail |
| `GET` | `/integrations/gmail/labels` | List Gmail labels |

**Calendar:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/integrations/calendar/events` | List calendar events |
| `POST` | `/integrations/calendar/events` | Create calendar event |
| `DELETE` | `/integrations/calendar/events/:id` | Delete calendar event |
| `GET` | `/integrations/calendar/list` | List available calendars |

**Drive:**
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/integrations/drive/folders/agents` | List agents with Drive folders |
| `POST` | `/integrations/drive/folders/agents/:agentId/setup` | Create agent folder structure |
| `GET` | `/integrations/drive/folders/:folderId/files` | List files in folder |
| `POST` | `/integrations/drive/folders` | Create folder |
| `POST` | `/integrations/drive/files` | Create/upload file |

### 2.4 Agent Folder Structure

When an agent's Drive folder is provisioned (via `setupAgentFolders` or lazily by any tool), the hierarchy is:

```
NeureCore/                          ← Tenant root (googleDriveRootFolderId)
└── <Agent Name>/                   ← Agent folder (googleDriveFolderId)
    ├── Drafts/
    ├── Documents/                  ← Default for document creation
    ├── Reports/                    ← Default for report generation
    ├── Templates/
    └── Archive/
```

The Drive folder is created via `POST https://www.googleapis.com/drive/v3/files` with `mimeType: application/vnd.google-apps.folder`. Files are uploaded via `POST https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart` with multipart/related encoding.

### 2.5 Cleanup Scheduler

`DriveCleanupService` runs on a configurable interval (`DRIVE_CLEANUP_INTERVAL_MS`, default 24h). It:
1. Finds TERMINATED agents whose `updatedAt` exceeds tenant's `retentionDays` (default 90)
2. Sends warning notifications 7 days before deletion
3. Deletes only empty folders (skips if children remain)
4. Clears `googleDriveFolderId` on the Agent record after deletion

---

## 3. Tenant Frontend

### 3.1 Pages and Routes

| Route | File | Purpose |
|-------|------|---------|
| `/login` | `src/app/login/page.tsx` | Google Sign-In button (GSI), account linking |
| `/settings/integrations` | `src/app/settings/integrations/page.tsx` | Integration listing: Google card with connect/disconnect |
| `/settings/integrations/google` | `src/app/settings/integrations/google/page.tsx` | Google status, scopes, Drive folder tree, disconnect danger zone |
| `/settings/integrations/google/compose` | `src/app/settings/integrations/google/compose/page.tsx` | Gmail compose form (To, Cc, Bcc, Subject, Body) |
| `/settings/integrations/callback/google` | `src/app/settings/integrations/callback/google/page.tsx` | OAuth callback handler (success/error display + redirect) |
| `/privacy` | `src/app/privacy/page.tsx` | Links to Google Privacy Policy |

### 3.2 Service Layer

`src/services/integrations.service.ts` — All Google API calls proxied through backend:

- OAuth: `initiateGoogleOAuth()`, `disconnectGoogle()`, `getGoogleStatus()`
- Gmail: `getInbox()`, `getMessage()`, `getMessageBody()`, `sendEmail()`, `getLabels()`
- Calendar: `getCalendarEvents()`, `createCalendarEvent()`, `deleteCalendarEvent()`, `listCalendars()`
- Drive: `listAgentFolders()`, `setupAgentFolders()`, `listDriveFiles()`, `createDriveFolder()`, `createDriveFile()`, `getGoogleDriveFolders()`

### 3.3 Google Sign-In (Login Page)

- Uses Google Identity Services (GSI) client library
- Dual intent: `signin` (first-time auth) and `link` (link Google to existing email/password account)
- Custom events `neurecore:google-account-exists` and `neurecore:google-link-account` handle account linking modal
- Calls `POST /auth/google` with `{ idToken, intent }`

### 3.4 OAuth Flow (Connect Google)

1. User clicks "Connect Google" on `/settings/integrations`
2. Frontend calls `POST /integrations/google/authorize` → receives Google OAuth URL
3. User is redirected to Google consent screen (scopes: Gmail, Drive, Calendar, Sheets)
4. Google redirects to `GET /integrations/google/callback?code=...&state=...`
5. Backend exchanges code for tokens, saves encrypted credentials, redirects to tenant UI at `/settings/integrations/callback/google?connected=true&email=...`
6. Tenant UI shows success banner, redirects to `/settings/integrations`

---

## 4. Admin Frontend

### 4.1 Current State

The admin frontend has **zero** Google Workspace integration UI:

- Only reference to "google" is in `src/services/api.ts:34,48` where `/auth/google` is listed in CSRF-exempt and refresh-exempt path arrays (for Google Sign-In login, not Workspace)
- No `settings/integrations` page exists
- The `IntegrationSettings` type only covers Slack/Discord/Webhook/Zapier
- The OAuth callback URL (`/settings/integrations/callback/google`) would 404 in admin SPA

### 4.2 Consequences

- Tenant admins cannot use the admin panel to connect/disconnect Google Workspace
- Cannot see which tenants have Google connected
- Cannot manage Google integration at a platform level
- OAuth callback redirect would silently break if triggered from admin context

---

## 5. AI Employee (Agent) Integration

### 5.1 Available Tools

| Tool | File | Actions | Google Service Used |
|------|------|---------|-------------------|
| **DocumentsTool** | `backend/src/modules/tools/built-in/documents.tool.ts` | `create`, `list`, `read` | Drive (create file, list files, read/export content) |
| **ReportsTool** | `backend/src/modules/tools/built-in/reports.tool.ts` | `generate`, `export_pdf` | Drive (create HTML in Reports folder, export as PDF) |
| **ContextTool** | `backend/src/modules/tools/built-in/context.tool.ts` | `load_drive`, `load_all` | Drive (list files, download snippet content) |
| **EmailTool** | `backend/src/modules/tools/built-in/email.tool.ts` | `read_inbox`, `get_message`, `send`, `flag` | Gmail (inbox, send, modify labels) |

### 5.2 Can AI Employees Access Their Specific Drive Folder?

**Yes — fully automated:**

1. When an agent first uses any Drive-related tool (`DocumentsTool`, `ReportsTool`, `ContextTool`), the tool calls `GoogleDriveService.setupAgentFolders()` which:
   - Ensures the tenant root `NeureCore/` folder exists (creates if missing, stores `googleDriveRootFolderId` on Tenant)
   - Creates/retrieves the agent's named folder under tenant root (stores `googleDriveFolderId` on Agent)
   - Creates 5 subfolders: `Drafts/`, `Documents/`, `Reports/`, `Templates/`, `Archive/`
   - Returns all folder IDs

2. Subsequent tool calls resolve the agent's folder ID from the database and operate within it — no need to re-create.

3. The `listAgentFolders` endpoint returns all agents with Drive folders for the tenant, linkable to the tenant UI.

### 5.3 Can AI Employees Access Documents in Their Folder?

**Yes — two levels:**

1. **`list` action** — Lists files in the agent's specified subfolder (default: `Documents/`). Returns file metadata (id, name, mimeType, webViewLink, modifiedTime, size).

2. **`read` action** — Downloads file content:
   - Google-native formats (Doc, Sheet, Slide) — exports as HTML via `files/{id}/export?mimeType=text/html`
   - Plain text/HTML files — downloads raw via `files/{id}?alt=media`
   - Content is returned in the tool result for the agent to process

### 5.4 Can AI Employees Create Documents in Their Folder?

**Yes:**

1. **DocumentsTool `create`** — Creates a new file (HTML or plain text) in the agent's specified subfolder (default: `Documents/`). Returns `fileId`, `webViewLink`, `mimeType`.

2. **ReportsTool `generate`** — Generates an HTML report with data from Prisma (tasks, costs, agent workload, pipeline) and saves it to the agent's `Reports/` subfolder in Drive. This is best-effort — if Drive is not connected, the HTML is still returned inline.

3. **ReportsTool `export_pdf`** — Takes an existing Drive file ID and exports it as PDF via Google's native `files/{id}/export?mimeType=application/pdf`. Returns base64-encoded PDF.

### 5.5 Can AI Employees Send/Read Email?

**Yes — via EmailTool:**
- Reads inbox (`read_inbox`) with optional Gmail search query and label filters
- Reads full message body (`get_message`)
- Sends email (`send`) — provider selection is auto or overridable:
  - If `agent.emailProvider === 'gmail'` and tenant has Google connected → uses Gmail
  - Otherwise falls back to Brevo
- Flags messages with priority labels (`flag`) — applies `IMPORTANT`/`STARRED` Gmail labels

### 5.6 Can AI Employees Manage Calendar Events?

**Partial — the backend `GoogleCalendarService` has full CRUD, but:**

- There is **no Calendar tool** wrapping it for AI agents (no file like `calendar.tool.ts` exists)
- Calendar endpoints exist on the REST controller but agents cannot call them directly
- Agents would need a `CalendarTool` to create/list/delete events programmatically

### 5.7 Can AI Employees Use Google Sheets?

**No — fully unimplemented:**
- The `spreadsheets` scope is requested during OAuth
- The tenant UI shows "Google Sheets — Read, write spreadsheets" as a granted scope
- But there is no:
  - Google Sheets service class
  - Sheets API endpoints
  - AI tool for sheets
  - Sheets MIME type references anywhere in code

---

## 6. Gap Analysis

### 6.1 Critical Missing Features

| Gap | Impact | Priority |
|-----|--------|----------|
| **No Google Sheets service** | Scope is requested but useless; agents cannot work with spreadsheets | High |
| **No Calendar Tool for agents** | Backend Calendar API exists but agents cannot use it | High |
| **Admin frontend has no Google integration UI** | Platform-level management impossible; OAuth callback would 404 | High |
| **No `drive-service.interface.ts`** | Imported but file doesn't exist at expected path (potential runtime issue) | Medium |
| **No auto-provisioning of agent folders** | Folders are lazily created on first tool use; no agent creation hook | Medium |
| **No Google Sheets MIME type (application/vnd.google-apps.spreadsheet)** | Even if Sheets service is added, Drive code doesn't handle native Sheets | Medium |
| **No tenant-scoped Google credential checking** | If Drive is disconnected mid-session, tools return errors without graceful fallback | Low |
| **No webViewLink returned from file creation** | `GoogleDriveService.createFile()` doesn't request `webViewLink` field from Drive API | Low |

### 6.2 Missing Admin UI Pages

The admin needs **at minimum**:
1. **Google OAuth connection page** — To connect the platform's own Google credentials or view per-tenant status
2. **Tenant Google integration status** — See which tenants have Google connected, view scopes
3. **Global Drive management** — View all agent Drive folders across tenants

### 6.3 OAuth Flow Risks

- OAuth callback (`/integrations/google/callback`) redirects to `FRONTEND_BASE_URL + /settings/integrations` — this uses `FRONTEND_BASE_URL` env var which may point to tenant UI only
- No admin-specific callback URL handling
- The `state` parameter encodes `tenantId` which is then used to store credentials — this is correct but there's no validation that the tenant matches the OAuth user

---

## 7. Agent Task Capability Matrix

| Task | Supported? | Tool/Service | Details |
|------|-----------|-------------|---------|
| Read inbox emails | ✅ | EmailTool → GoogleGmailService | Lists messages with sender/subject/snippet/search |
| Send email from agent alias | ✅ | EmailTool → GmailEmailProvider | Auto-resolves provider (Gmail vs Brevo) |
| Flag email as urgent/important | ✅ | EmailTool → Gmail API | Applies IMPORTANT/STARRED labels |
| List files in agent's Drive folder | ✅ | DocumentsTool → GoogleDriveService | Lists Documents/Drafts/Reports/etc |
| Create a document in agent's folder | ✅ | DocumentsTool → GoogleDriveService | HTML or plain text, multipart upload |
| Read document content from Drive | ✅ | DocumentsTool → GoogleDriveService | Exports Google-native formats as HTML |
| Generate data report + save to Drive | ✅ | ReportsTool → GoogleDriveService | HTML report saved to Reports/ subfolder |
| Export Drive doc as PDF | ✅ | ReportsTool → GoogleDriveService | Via Drive export API |
| Load Drive docs as context | ✅ | ContextTool → GoogleDriveService | Snippets documents for agent context |
| List calendar events | ⚠️ | REST only | Backend API exists, no agent tool wrapper |
| Create calendar event | ⚠️ | REST only | Backend API exists, no agent tool wrapper |
| Create/edit Google Sheets | ❌ | Not implemented | Scope requested, no service exists |
| Read Google Sheets data | ❌ | Not implemented | No Sheets API calls exist |
| Share Drive files with users | ❌ | Not implemented | No Drive permission API calls |
| Search across Drive | ❌ | Not implemented | Only folder-scoped list, no full-text search |

---

## 8. Recommendations

### Phase 1 — Fill Critical Gaps

1. **Create `CalendarTool`** — Wrap existing `GoogleCalendarService` as an agent tool matching the pattern of `DocumentsTool`/`EmailTool` (actions: `list`, `create`, `delete`, `find_free_slots`).

2. **Create Google Sheets service** (`google-sheets.service.ts`):
   - Use `sheets.googleapis.com/v4/spreadsheets` API
   - Support: create spreadsheet, read range, write range, append rows
   - Respect the existing OAuth token flow from `GoogleAuthClient`

3. **Build admin Google integration UI**:
   - Integration settings page matching tenant pattern
   - Per-tenant Google connection status view (read-only at minimum)
   - Fix OAuth callback redirect for admin context

### Phase 2 — Enhancements

4. **Add `webViewLink` to Drive file creation responses** — `GoogleDriveService.createFile()` should request `webViewLink` in the API call fields parameter so agents can return clickable links.

5. **Auto-provision agent Drive folders on agent creation** — Add a hook in `AgentsService.create()` to call `setupAgentFolders` so folders exist before first tool use.

6. **Add Drive search capability** — `GoogleDriveService.listFiles` only searches by parent folder; add full-text search via Drive API `q` parameter for agent context loading.

### Phase 3 — Advanced

7. **Google Sheets agent tool** (`sheets.tool.ts`):
   - Actions: `create_spreadsheet`, `read_range`, `write_range`, `append_rows`, `get_sheet_metadata`
   - Store spreadsheet IDs in Agent metadata for easy reference
   - Support CSV/TSV import into new sheets

8. **Drive permission management** — Allow agents to share files/folders with specific email addresses via Drive API permissions endpoint.

9. **Multi-account Google integration** — Support connecting multiple Google accounts per tenant (e.g., one for Drive, another for Gmail).
