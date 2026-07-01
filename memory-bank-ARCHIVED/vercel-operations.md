# NeureCore Frontends — Vercel Operations Reference

**Last verified:** 2026-06-29 (post EAOS frontend deploy, Sentry stripped, devDeps install fix)
**Audience:** Any engineer tasked with deploying or debugging the Next.js frontends
**Purpose:** Stop the recurring "stuck on Vercel deploy" pattern. Everything below was discovered the hard way.

---

## 0. Quick Facts (Memorize These)

| Item | Tenant frontend | Admin frontend | EAOS frontend |
|---|---|---|---|
| Local source dir | `/home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant/` | `.../frontend-admin/` | `.../frontend-eaos/` |
| Vercel project ID | `prj_EV6YAjwGAnneM6OlVmkDuXWt3M9e` | `prj_PnHNvyq8699ohZmrmUAwGzTlkMzH` | `prj_2Xi6mqsvUwGOsQhFqQHthsCs91ru` |
| Vercel project name | `neurecorebase-tenant` | `neurecorebase` | `frontend-eaos` |
| Org (team) | `team_wOWHtzagqXIj1iVZOpaeP4vz` | same | same |
| Vercel rootDirectory | `frontend-tenant` | *(not set in dashboard — see §4)* | `frontend-eaos` |
| Production URL | `https://hq.neurecore.com` | `https://cc.neurecore.com` | `https://frontend-eaos-shahisoftai-7053s-projects.vercel.app` (no custom domain yet) |
| Vercel-generated URL | `https://neurecorebase-tenant.vercel.app` | `https://neurecorebase.vercel.app` | `https://frontend-eaos-shahisoftai-7053s-projects.vercel.app` |
| Git branch | `main` (auto-deploys on push) | `main` (auto-deploys on push) | `main` (auto-deploys on push) |
| Framework | Next.js 15 | Next.js 15 | **Next.js 16.2.9 (Turbopack default)** |
| Vercel CLI (project-local) | `/home/najeeb/.local/share/pnpm/bin/vercel` v54.6.1 OR `npx vercel` v54.17.3 | same | same |
| Authenticated user | `shahisoftai-7053` (via `vercel whoami`) | same | same |
| `.vercel/project.json` exists? | Yes (per-folder link) | Yes (per-folder link) | Yes (per-folder link) |
| `vercel.json` exists? | **No** | **Yes** (rewrites all `/x` to `/admin/x`) | **No** |
| Install command | `npm install --legacy-peer-deps` | same | **`npm install --legacy-peer-deps --include=dev`** ⚠️ |
| Node version | `24.x` (per dashboard; runtime is 22.12 — see §3) | same | `24.x` |
| Sentry enabled? | Yes (env vars + next.config) | Yes | **No — stripped (see §12)** |
| SSO/Vercel Auth | Default (off for tenant) | Default (off for admin) | **MUST be explicitly disabled** (see §1.6) |
| Env file (local) | `.env.production` (committed, contains `NEXT_PUBLIC_*` only) | `.env.production` | `.env.example` only (no `.env.production` committed) |

**Backend (used by both frontends):**
- Public URL: `https://brain.neurecore.com/api/v1/`
- Source: `/home/najeeb/Linux-Dev/neurecore-base/neurecore/backend/` → deployed to **Contabo** (NOT Vercel)
- See `memory-bank/contabo-operations.md` for backend deploy procedure

---

## 1. Why Frontend Deploys Get Stuck (Root Causes)

These cost most of the time on every Vercel session. Internalize them.

### 1.1 `vercel deploy --prod` Fails With Duplicate-Path Error

**Symptom:**
```
Error: The provided path "~/Linux-Dev/neurecore-base/neurecore/frontend-tenant/frontend-tenant" does not exist.
```

**Cause:** The Vercel dashboard sets `rootDirectory: "frontend-tenant"` for this project. The CLI computes `cwd + rootDirectory` and gets a duplicate path. Affects both `vercel deploy` from inside `frontend-tenant/` AND from any other cwd.

**Why git-push auto-deploy works but `vercel deploy` doesn't:** Vercel's git integration uses the same rootDirectory setting but interprets it correctly (relative to repo root). The CLI has the bug.

**Fix:** Just `git push`. Don't use `vercel deploy`. The git integration auto-deploys within ~1 minute.

### 1.2 `pnpm install` Fails During Vercel Build

**Symptom:** Build log shows `ERR_PNPM_PEER_DEP_ISSUES` or `EACCES` from pnpm during install.

**Cause:** Dashboard install command is `npm install --legacy-peer-deps` (this is what the build uses), but local dev used `pnpm install`. If you try to force pnpm via `vercel.json`, conflicts arise.

**Fix:** Leave install command as `npm install --legacy-peer-deps` in dashboard. Do NOT add `"installCommand"` overrides unless you know what you're doing.

### 1.3 Node Version Mismatch

**Symptom:** Build succeeds locally but fails on Vercel (or vice versa).

**Cause:** Dashboard says `nodeVersion: "24.x"` but local runtime is Node 22.12. Some native deps or syntax features behave differently.

**Fix:** Either (a) bump local Node to 24 to match Vercel, or (b) set dashboard `nodeVersion` to `22.x`. Don't try to write code that's only compatible with one — pick a version and standardize.

### 1.4 Env Vars Set in `.env.production` Aren't Used by Vercel

**Symptom:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` is in your `.env.production` file (committed to git) but production deployment still complains "Missing Google Client ID".

**Cause:** Vercel does NOT read `.env.production` during build. Env vars MUST be set in the Vercel dashboard (or via `vercel env add`).

**Fix:** `vercel env ls production` to check what's set. `vercel env add NAME production` to add. **NEVER put real secrets in `.env.production`** — those would leak to git. Only `NEXT_PUBLIC_*` (public-safe) values are safe to commit.

### 1.5 `NEXT_PUBLIC_GOOGLE_CLIENT_ID` Flagged as "Missing"

**Symptom:** Login page "Continue with Google" button does nothing. Console shows empty string for the client ID.

**Cause:** This var is needed for Google Identity Services (GIS) script init. If it's missing in Vercel env vars, the button never renders.

**Fix:**
```bash
vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID production
# paste the value from Google Cloud Console (matches GOOGLE_CLIENT_ID on backend)
```

**Status (verified 2026-06-27):** ✅ Set on Vercel for `neurecorebase-tenant`. Added 9 hours ago (Session 6 fix).

### 1.6 Vercel Authentication (SSO) Default-On Shows "Log in to Vercel" Page

**Symptom:** Deployment status is `● Ready` (200 HTTP), but visiting the URL shows Vercel's own login page ("Log in to Vercel", "Continue with Email/GitHub/Apple", `auth-layout` class). NOT your app. The Inspect view shows empty `Builds` (`[0ms]`).

**Cause:** The project has `ssoProtection.deploymentType: "all_except_custom_domains"` set (Vercel Authentication ON by default for many new projects, and explicitly enabled for the EAOS project). This protects all `*.vercel.app` generated URLs until you disable it.

**How to detect:** Hit the deployed URL with `curl` and grep for `Log in to Vercel` or `auth-layout`. Or check via API:
```bash
curl -s "https://api.vercel.com/v9/projects/<PROJECT_ID>" \
  -H "Authorization: Bearer $(cat ~/.local/share/com.vercel.cli/auth.json | grep -o '"token":"[^"]*"' | cut -d'"' -f4)" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('ssoProtection'))"
# If output: {"deploymentType": "all_except_custom_domains"} → protected
```

**Fix (via API, no dashboard needed):**
```bash
TOKEN=$(cat ~/.local/share/com.vercel.cli/auth.json | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
curl -s -X PATCH "https://api.vercel.com/v9/projects/<PROJECT_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection": null}'
```

**Equivalent dashboard path:** Settings → **Deployment Protection** (NOT "General") → Vercel Authentication → toggle off.

**Important:** This is in the **Deployment Protection** settings page, NOT General. The user might say "there's no protection in General" — that is correct. The setting is elsewhere.

**Status (verified 2026-06-29):** ✅ Disabled for `frontend-eaos`.

### 1.7 Build Fails: "Cannot find module 'tailwindcss'" / Missing devDependencies

**Symptom:** Local `npm run build` is green. Vercel build fails with:
```
Error: Cannot find module 'tailwindcss'
./node_modules/react-grid-layout/css/styles.css
Error evaluating Node.js code
```
Or similar module-not-found errors for PostCSS plugins, `typescript`, `eslint-config-next`, etc.

**Cause:** Vercel runs `npm install` TWICE during a deploy:
1. **Install phase:** `npm install --legacy-peer-deps` → installs both deps + devDeps (e.g., 467 packages)
2. **Build phase:** Vercel re-runs `npm install` (with `NODE_ENV=production` set) → strips devDeps (e.g., drops to 115 packages)

If `tailwindcss`, `postcss`, `typescript`, `eslint`, etc. are in `devDependencies`, they get removed before the build runs, and PostCSS/Next.js can't find them.

**Fix (via API, set install command to force devDeps):**
```bash
TOKEN=$(cat ~/.local/share/com.vercel.cli/auth.json | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
curl -s -X PATCH "https://api.vercel.com/v9/projects/<PROJECT_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"installCommand": "npm install --legacy-peer-deps --include=dev"}'
```

**Alternative fix:** Move build-time tools (tailwindcss, postcss, typescript, eslint) from `devDependencies` to `dependencies` in `package.json`. This works but is semantically wrong (they're not runtime deps).

**Status (verified 2026-06-29):** ✅ `installCommand` set to `npm install --legacy-peer-deps --include=dev` on `frontend-eaos`.

---

## 2. Safe Deploy Procedure (Copy-Paste This)

### Method A — Git Push (Recommended)

This is the canonical method. It works around the `vercel deploy` bug and is what the team uses.

```bash
# 1. Local build verification (catches most issues before Vercel does)
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant
npx next build
# Expect: "Compiled successfully" + route table

# 2. Commit + push from the repo root (so memory-bank + plans also get committed)
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore
git add -A
git commit -m "feat(tenant): <description>

- <bullet>
- <bullet>"
git push origin main
# Expect: "<hash>..<newhash>  main -> main"

# 3. Watch Vercel auto-deploy (1-2 minutes)
# Either: GitHub Actions/Deployments tab
# Or CLI:
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant
npx vercel ls 2>&1 | grep "Ready\|Building\|Error" | head -3
# Refresh every 30s until you see "● Ready"

# 4. Inspect the deployment
npx vercel inspect <deployment-url-or-alias>
# Look for: target=production, status=● Ready, aliases include hq.neurecore.com

# 5. Smoke-test the new routes on production
curl -s -o /dev/null -w "GET /onboarding/setup → %{http_code}\n" https://hq.neurecore.com/onboarding/setup
curl -s -o /dev/null -w "GET /login → %{http_code}\n" https://hq.neurecore.com/login
curl -s -o /dev/null -w "GET /settings/integrations/google → %{http_code}\n" https://hq.neurecore.com/settings/integrations/google
```

### Method B — Manual CLI Deploy (Broken, Don't Use)

```bash
# THIS WILL FAIL on this project due to the rootDirectory bug
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant
vercel deploy --prod --yes
# Error: "The provided path '...frontend-tenant/frontend-tenant' does not exist"

# Workaround: temporarily unset rootDirectory in dashboard, deploy, restore.
# DO NOT DO THIS. Just use Method A.
```

### Admin Frontend (Same Procedure, Different Folder)

```bash
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-admin
npx next build
cd ..
git add frontend-admin/
git commit -m "feat(admin): <description>"
git push origin main
# Auto-deploys to cc.neurecore.com
```

---

## 3. Critical Pitfalls

### 3.1 `vercel deploy` Bug: Duplicate Path

See §1.1. **Workaround: use git push.** If you MUST use the CLI (e.g., for testing a specific branch deploy), use `--no-wait` with explicit git ref:

```bash
cd /home/najeeb/Linux-Dev/neurecore-base
vercel deploy --prod --yes --no-wait frontend-tenant
```

Even then, the dashboard rootDirectory setting interferes. **Just use git push.**

### 3.2 Build Fails with `Cannot find module 'X'` on Vercel

**Symptom:** Local build works. Vercel build fails with module-not-found.

**Cause:** The local `node_modules` may have a package the Vercel fresh install doesn't pull. Or a peer dep is silently dropped.

**Fix:**
1. `rm -rf node_modules package-lock.json pnpm-lock.yaml`
2. `npm install --legacy-peer-deps`
3. `npm run build` locally — must succeed
4. Commit `package-lock.json` (and delete `pnpm-lock.yaml` if it conflicts)
5. Push

### 3.3 Login Button Doesn't Render

**Symptom:** Google Sign-In button missing on login page in production.

**Cause:** `NEXT_PUBLIC_GOOGLE_CLIENT_ID` not set in Vercel dashboard. Without it, the GIS script doesn't init.

**Fix:** `vercel env add NEXT_PUBLIC_GOOGLE_CLIENT_ID production` with the Google OAuth client ID.

### 3.4 `vercel.json` Admin Rewrites Don't Apply

**Symptom:** `cc.neurecore.com/agents` returns 404 instead of rewriting to `/admin/agents`.

**Cause:** `vercel.json` rewrites only apply to the project they're defined in. The admin project (`neurecorebase`) has rewrites; the tenant project (`neurecorebase-tenant`) does not. If you add a `/agents` rewrite to the tenant project, it will conflict.

**Fix:** Don't add rewrites to tenant. Rewrites go in `frontend-admin/vercel.json` only. The tenant project serves URLs directly from `src/app/*` paths.

### 3.5 Build Cache Causes Stale Deploys

**Symptom:** You pushed a code change but Vercel serves the old version.

**Cause:** Vercel cached the build output. Force a clean rebuild:

**Fix:**
```bash
# Method 1: Push an empty commit to trigger fresh build
git commit --allow-empty -m "chore: force Vercel rebuild"
git push origin main

# Method 2: Use Vercel CLI to invalidate cache
vercel --force deploy  # still hits the CLI bug
```

### 3.6 Local Build Passes, Vercel Build Fails (Type Errors)

**Symptom:** `next build` locally is green. Vercel build red.

**Cause:** Different Node versions, or different lockfile resolution. The Vercel install runs `npm install --legacy-peer-deps` from scratch using their Node version.

**Fix:** Match local Node to dashboard Node version. Check `vercel.json` if exists for `engines` overrides. Run `npm ci` locally to verify the install command Vercel uses works on your local Node.

### 3.7 RootDirectory in `.vercel/project.json` Is Set But Not Visible

**Symptom:** You see rootDirectory="frontend-tenant" in `.vercel/project.json` but can't figure out where it was set.

**Cause:** This is the dashboard setting, synced to `.vercel/project.json` via `vercel pull`. To change it:

**Fix:** Vercel Dashboard → Project → Settings → General → Root Directory → Edit → Save. Then `vercel pull` locally to sync.

---

## 4. Project Settings (Verified 2026-06-27)

### Tenant (`neurecorebase-tenant`)

```json
{
  "framework": "nextjs",
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "npm run build",
  "rootDirectory": "frontend-tenant",
  "nodeVersion": "24.x",
  "directoryListing": false
}
```

**Env vars (production):**
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID` — set (added 2026-06-26 in Session 6 fix)

**Aliases (production):**
- `hq.neurecore.com` ← primary public URL
- `neurecorebase-tenant.vercel.app`
- `neurecorebase-tenant-shahisoftai-7053s-projects.vercel.app`
- `neurecorebase-tenant-git-main-shahisoftai-7053s-projects.vercel.app`

### Admin (`neurecorebase`)

```json
{
  "framework": "nextjs",
  "installCommand": "npm install --legacy-peer-deps",
  "buildCommand": "npm run build",
  // rootDirectory NOT set — admin serves from repo root with vercel.json rewrites
  "nodeVersion": "24.x"
}
```

**`vercel.json` (in `frontend-admin/`):**
- 30+ rewrites: `/x` → `/admin/x`
- No env vars specific to admin (it shares backend envs)

**Aliases:**
- `cc.neurecore.com` ← primary public URL
- `neurecorebase.vercel.app`

---

## 5. Emergency Recovery

### 5.1 Roll Back to Previous Deploy

Vercel keeps every deployment. To promote an older deployment to production:

**Via Dashboard:**
1. Project → Deployments
2. Find the last good deployment
3. Click ⋯ menu → "Promote to Production"

**Via CLI:**
```bash
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant
vercel rollback --yes
# OR explicitly:
vercel promote <previous-deployment-url>
```

### 5.2 Force Rebuild Without Code Change

```bash
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore
git commit --allow-empty -m "chore: force Vercel rebuild $(date +%Y%m%d-%H%M)"
git push origin main
```

### 5.3 Failed Mid-Build

Vercel keeps partial deploys but does not promote them. Just push a fix or rollback. No manual cleanup needed.

### 5.4 Stuck "Building" State

If a deployment shows "Building" for >5 minutes (Vercel usually finishes in 1-2 min for Next.js):

1. Check `npx vercel ls` for current state
2. If still building: wait, or check Vercel dashboard "Logs"
3. If >10 min stuck: rollback via dashboard, then investigate

---

## 6. Diagnostic Commands (Bookmark These)

### Vercel Auth + Project Info

```bash
vercel whoami                                                  # logged-in user
vercel env ls production                                       # env vars
vercel ls                                                       # recent deployments
vercel inspect <deployment-url-or-alias>                      # deployment details
```

### Local Build Verification

```bash
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-tenant
npx next build                                                  # production build
npx next dev                                                    # local dev server (port 3000)
npx tsc --noEmit                                                # type check only
```

### Smoke Tests on Production

```bash
# Tenant frontend
curl -s -o /dev/null -w "/onboarding/setup → %{http_code}\n" https://hq.neurecore.com/onboarding/setup
curl -s -o /dev/null -w "/login → %{http_code}\n" https://hq.neurecore.com/login
curl -s -o /dev/null -w "/settings/integrations/google → %{http_code}\n" https://hq.neurecore.com/settings/integrations/google

# Admin frontend
curl -s -o /dev/null -w "/admin → %{http_code}\n" https://cc.neurecore.com/admin
curl -s -o /dev/null -w "/admin/login → %{http_code}\n" https://cc.neurecore.com/admin/login

# Backend (sanity check from frontend's perspective)
curl -s -o /dev/null -w "API health → %{http_code}\n" https://brain.neurecore.com/api/v1/health
```

### Vercel Project Config

```bash
cat .vercel/project.json           # linked project info + dashboard settings
vercel pull --environment=production   # sync .vercel/.env.production.local + project.json
```

---

## 7. What NOT to Do (Lessons Learned)

1. ❌ **Don't run `vercel deploy --prod` from `frontend-tenant/`** — fails with duplicate-path error. Use git push.
2. ❌ **Don't put real secrets in `.env.production`** — only `NEXT_PUBLIC_*` (public-safe) values. Server secrets (e.g., API keys) go in Vercel dashboard only.
3. ❌ **Don't change rootDirectory without coordinating** — `frontend-tenant` project has it set to `frontend-tenant`. Changing it breaks the deploy path resolution.
4. ❌ **Don't add `vercel.json` to the tenant project** — admin already has 30+ rewrites. Adding more to tenant causes URL conflicts.
5. ❌ **Don't use `npm install` locally without `--legacy-peer-deps`** — fails on framer-motion peer dep mismatch. Mirror Vercel's install command.
6. ❌ **Don't trust local builds alone** — always check Vercel's actual deploy output. Run `npx vercel ls` after push to confirm.
7. ❌ **Don't deploy on Fridays without verifying** — Vercel auto-deploys on push. A bad merge can take down production in 60 seconds.
8. ❌ **Don't ignore `npm install --legacy-peer-deps`** — it's the install command Vercel uses. If you want to change it, change the dashboard setting, not your local workflow.
9. ❌ **Don't try to deploy admin from inside admin dir** — same rootDirectory bug. Use git push.
10. ❌ **Don't assume `.env.production` reaches Vercel** — it doesn't. Vercel has its own env store. Use `vercel env add` or the dashboard.

---

## 8. File Map (What's Where Locally)

```
/home/najeeb/Linux-Dev/neurecore-base/neurecore/
├── frontend-tenant/                     # Tenant Next.js app
│   ├── .env.production                  # PUBLIC env vars only (committed)
│   ├── .env.local                       # Local dev secrets (gitignored)
│   ├── .vercel/
│   │   ├── project.json                 # Linked project info — rootDirectory: frontend-tenant
│   │   └── .env.production.local        # Generated by `vercel pull` — has real secrets
│   ├── src/                             # Next.js app
│   │   ├── app/
│   │   │   ├── onboarding/setup/        # NEW: WS-2 onboarding wizard
│   │   │   ├── settings/integrations/   # Updated: WS-5 Brevo badge
│   │   │   ├── settings/integrations/google/  # NEW: WS-3.1 Manage Google
│   │   │   └── login/                   # Updated: WS-6.3 link-account prompt
│   │   └── services/
│   │       ├── onboarding.service.ts    # NEW: WS-2 backend client
│   │       ├── tiers.service.ts         # NEW: WS-2 tier list
│   │       └── department-templates.service.ts  # NEW: WS-2 templates
│   └── package.json
│
├── frontend-admin/                      # Admin Next.js app (URLs /admin/*)
│   ├── vercel.json                      # 30+ rewrites /x → /admin/x
│   ├── .vercel/project.json             # Linked project — no rootDirectory
│   └── src/                             # All routes prefixed /admin/
│
└── backend/                             # NestJS — deployed to Contabo (NOT Vercel)
    └── src/
```

---

## 9. Env Vars Reference

### Frontend Tenant (Vercel dashboard → `neurecorebase-tenant` → Settings → Environment Variables)

| Name | Value Source | Required For |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | `https://brain.neurecore.com/api/v1` | All API calls |
| `NEXT_PUBLIC_TENANT_URL` | `https://hq.neurecore.com` | OAuth redirects, share links |
| `NEXT_PUBLIC_ADMIN_URL` | `https://cc.neurecore.com` | "Open Admin" links |
| `NEXT_PUBLIC_APP_NAME` | `NeureCore` | Branding |
| `NEXT_PUBLIC_APP_VERSION` | `1.0.0` | Footer / about |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google Cloud Console OAuth client ID | Google Sign-In button |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry project DSN | Error reporting |
| `NEXT_PUBLIC_SENTRY_ENVIRONMENT` | `production` | Sentry env tagging |
| `NEXT_PUBLIC_API_TIMEOUT` | `30000` (ms) | API request timeout |

**Status (verified 2026-06-27):** Only `NEXT_PUBLIC_GOOGLE_CLIENT_ID` was visible via `vercel env ls`. Other values may be set in dashboard but not listed (CLI may filter on `environments` flag). To see all: visit `https://vercel.com/shahisoftai-7053s-projects/neurecorebase-tenant/settings/environment-variables`.

### Frontend Admin

Admin frontend uses the same backend URL. Most envs are inherited or not needed. The `vercel.json` rewrites handle URL mapping.

---

## 10. Recent Deploy Log (For Pattern Recognition)

| Date | Change | Outcome | Issue Encountered |
|---|---|---|---|
| 2026-06-26 (Session 6) | First Google Sign-In frontend deploy | ✅ Live | `NEXT_PUBLIC_GOOGLE_CLIENT_ID` missing in Vercel → added via dashboard |
| 2026-06-26 (Session 8) | Vercel rootDirectory fix | ✅ Live | `rootDirectory: "frontend-tenant"` was missing, set in dashboard |
| 2026-06-27 (Session 13) | Phase C–F + Onboarding frontend | ✅ Live (auto-deployed from git push) | Tried `vercel deploy --prod` first, hit duplicate-path bug, fell back to git push — worked in 1 minute |
| 2026-06-29 (EAOS) | First EAOS frontend deploy | ✅ Live | Three compounding issues: (1) `ssoProtection` was on by default — Vercel showed its own login page, looked like build was broken but it wasn't; (2) `installCommand` was `npm install --legacy-peer-deps` which stripped devDeps (`tailwindcss`, `typescript`) at build time → "Cannot find module 'tailwindcss'"; (3) leftover `next.config.js` + Sentry `.bak` files + `turbopack.root: '.'` in `next.config.mjs` caused confusion. Fix: API PATCH for `ssoProtection: null` + `installCommand: "npm install --legacy-peer-deps --include=dev"`, then strip Sentry, delete root-level `package.json`/`pages/`, remove `turbopack.root` |

---

## 12. Frontend-EAOS Notes (Next.js 16 + Turbopack)

EAOS is a newer Next.js 16.2.9 app (upgraded from 15.0.3) that uses Turbopack as the default bundler. Several quirks differ from the tenant/admin frontends:

### 12.1 Sentry Was Stripped

**Why:** Sentry's `withSentryConfig` wrapper requires `@sentry/nextjs` to be installed and configured with the right DSN. The EAOS frontend was a fork that never fully wired Sentry, and the broken config was preventing builds.

**What was removed (2026-06-29):**
- `next.config.mjs` no longer uses `withSentryConfig`
- `_instrumentation.js.bak` / `_instrumentation-client.js.bak` (renamed from `.ts`)
- `_sentry.server.config.js.bak` / `_sentry.edge.config.js.bak`
- `next.config.js` at repo root (the Sentry-wrapped config that was being picked up)

**If you need Sentry back:**
1. `npm install @sentry/nextjs`
2. Restore sentry config files (remove `.bak`)
3. Add `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` env vars to Vercel
4. Re-wrap `next.config.mjs` with `withSentryConfig`

### 12.2 Turbopack Default Means Different Build Behavior

Next.js 16 uses Turbopack for `next build` by default. Differences from webpack:

- **No `turbopack.root`:** Setting `turbopack: { root: '.' }` in `next.config.mjs` causes Vercel warnings (`Both outputFileTracingRoot and turbopack.root are set`). **Do not set turbopack.root unless you know you need it.**
- **PostCSS resolution:** Turbopack resolves PostCSS plugins differently. `postcss.config.cjs` must export `tailwindcss: {}` (not `require('tailwindcss')({})`) for it to be found.
- **Turbopack-specific errors:** If you see `turbopack:///[turbopack-node]/transforms/postcss.ts` in stack traces, the issue is PostCSS/Tailwind, not your code.

**Escape hatch:** Set `NEXT_DISABLE_TURBOPACK=1` env var on Vercel to use webpack instead. Use only if Turbopack is blocking you.

### 12.3 Vendored `@neurecore/ui` Components

The original `packages/ui/` and `shared/` folders at the repo root caused Vercel build failures (cross-directory imports outside `rootDirectory`). Solution (2026-06-29):

- Deleted `packages/` and `shared/` from repo root
- All UI components are **vendored** at `frontend-eaos/src/ui/` (copy of the originals)
- Imports in `src/` use relative paths: `import { Button } from '@/ui/button'` (NOT `@neurecore/ui/button`)

**If you need to update shared components:** edit the files in `frontend-eaos/src/ui/` directly. They are not symlinked to a shared package.

### 12.4 EAOS-Specific DOs

| DO | Why |
|---|---|
| Set `installCommand: "npm install --legacy-peer-deps --include=dev"` in Vercel project | Prevents devDeps from being stripped during build (see §1.7) |
| Set `ssoProtection: null` on the Vercel project | Default Vercel Auth blocks generated URLs (see §1.6) |
| Keep `turbopack.root` unset in `next.config.mjs` | Avoids Vercel warnings and path resolution issues |
| Use `frontend-eaos/` as `rootDirectory` (set in Vercel dashboard) | Tells Vercel where to find `package.json` and `next.config.mjs` |
| Commit `package-lock.json` | Vercel uses `npm install` not `npm ci`, so the lockfile pins versions |

### 12.5 EAOS-Specific DON'Ts

| DON'T | Why |
|---|---|
| ❌ Don't put `vercel.json` at the repo root | Conflicts with `rootDirectory: frontend-eaos`; Vercel uses the framework default |
| ❌ Don't put `package.json` at the repo root | Vercel will pick it up and ignore `frontend-eaos/package.json` |
| ❌ Don't put `pages/` directory at the repo root | Vercel tries to build it instead of `frontend-eaos/src/app/` |
| ❌ Don't enable Sentry config without `@sentry/nextjs` installed | Build will fail looking for the package |
| ❌ Don't set `turbopack.root: '.'` | Causes Vercel path resolution warnings |
| ❌ Don't reference `@neurecore/ui/*` imports | That package no longer exists; use `@/ui/*` (relative) |
| ❌ Don't try to deploy with `vercel deploy --prod` from inside `frontend-eaos/` | Same rootDirectory bug as tenant/admin — use git push |

### 12.6 EAOS Build & Deploy Commands

```bash
# 1. Local build verification
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore/frontend-eaos
npx next build
# Expect: "Compiled successfully" with route table (/, /login, /marketplace, /agents, etc.)

# 2. Commit + push
cd /home/najeeb/Linux-Dev/neurecore-base/neurecore
git add -A
git commit -m "feat(eaos): <description>"
git push origin main

# 3. Watch deploy
cd frontend-eaos
npx vercel ls 2>&1 | grep "Ready\|Building\|Error" | head -3

# 4. Smoke test
curl -sL https://frontend-eaos-shahisoftai-7053s-projects.vercel.app/ | grep -oE "EAOS|NeureCore" | head -2
```

---

## 11. When to Read Each Memory-Bank File

| Situation | Read this file |
|---|---|
| Deploying or debugging Contabo backend | `memory-bank/contabo-operations.md` |
| Deploying or debugging Vercel frontends | `memory-bank/vercel-operations.md` (this file) |
| Daily Tools plan / status | `memory-bank/daily-tools-integration-plan.md` |
| Gap-closure plan / status | `plans/daily-tools-gaps-implementation-plan.md` |
| General maintenance procedures | `memory-bank/runbook.md` |
| Latest session summary | `memory-bank/activeContext.md` |
| Initial setup | `memory-bank/techContext.md` + `memory-bank/systemPatterns.md` |

---

**Bottom line:** for Vercel frontends, the canonical deploy is `git push`. The CLI has a bug that breaks `vercel deploy` from inside a project with `rootDirectory` set. Use the dashboard or git integration; don't fight the CLI. For env vars, remember: `.env.production` is for `NEXT_PUBLIC_*` values (committed), and secrets live in the Vercel dashboard only.