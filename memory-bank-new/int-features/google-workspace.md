# Google Workspace

## Overview
Integrate NeureCore AI employees with Google Workspace: Gmail, Google Drive, Google Calendar, and Google Sheets. This is the most fully implemented integration feature.

## Category
INTEGRATION (integrationKey: `google_workspace`)

## Implementation Status
- ✅ **Fully audited** — see [google-services.md](./google-services.md) for comprehensive details

## Quick Reference
| Area | Status | Details |
|------|--------|---------|
| Backend | ✅ | `GoogleDriveService`, `GoogleGmailService`, `GoogleCalendarService`, `GoogleAuthClient`, Drive cleanup scheduler, OAuth flow |
| Tenant UI | ✅ | Google Sign-In, integration connect/disconnect, Drive tree view, Gmail compose, OAuth callback |
| Admin UI | ❌ | No admin Google integration page — OAuth callback would 404 |
| Agent Tools | ✅ | `EmailTool` (Gmail), `DocumentsTool` (Drive), `ReportsTool` (Drive), `ContextTool` (Drive) |
| Sheets | ❌ | Scope requested but no Sheets API calls exist — no sheets service, no agent tool |

## OAuth Scopes Requested
- `gmail.readonly`, `gmail.send`, `drive`, `calendar`, `spreadsheets`

## Key File References
- `backend/src/modules/integrations/google/` — 6 service files
- `frontend-tenant/src/app/settings/integrations/google/` — status, compose pages
- `frontend-tenant/src/services/integrations.service.ts` — all Google API calls

## Implementation Gaps
- See [google-services.md Gaps section](./google-services.md#7-gap-analysis)
- **Critical**: Google Sheets service missing, Calendar tool missing for agents, admin UI absent
