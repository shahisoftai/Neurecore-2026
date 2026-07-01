# Memory Bank — ARCHIVED

**This directory contains the PREVIOUS Memory Bank — archived on 2026-06-30.**

## Status

**SUPERSEDED** — All documentation has been replaced by the new Memory Bank in the parent `memory-bank/` directory.

## What Changed

The One-Source Contabo Consolidation (2026-06-30) fundamentally changed the production architecture:

- All services now run on Contabo VPS (109.123.248.253)
- `frontend-eaos` replaces `frontend-tenant` as the tenant frontend
- `frontend-admin` deployed to Contabo (previously Vercel)
- LiteSpeed vhosts for `hq.neurecore.com`, `cc.neurecore.com`, `brain.neurecore.com`
- DNS fully pointed to Contabo
- New deployment scripts and procedures

## New Memory Bank

All future operations should reference:

```
../memory-bank/
```

This archive is kept for historical reference only.

## Archived Files

All files from the previous Memory Bank have been moved here:
- `activeContext.md`
- `agent-implementation.md`
- `ai-chat-architecture.md`
- `contabo-operations.md`
- `deployment-guide.md`
- `EAOS/` (complete subdirectory)
- `new_neurecore.md`
- `onboarding-flow.md`
- `productContext.md`
- `progress.md`
- `projectBrief.md`
- `runbook.md`
- `systemPatterns.md`
- `techContext.md`
- `verification-checklist.md`
- `vercel-operations.md`
- And more...

## Do Not Reference

Do not use documents in this archive for current operations. They may contain:
- Outdated deployment methods
- Obsolete architecture descriptions
- Stale status reports
- Old Vercel-specific procedures

**Use only the new Memory Bank in `../memory-bank/` for all future work.**
