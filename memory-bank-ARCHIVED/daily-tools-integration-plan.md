# NeureCore — Daily Tools & Integration Plan

**Document Version:** 1.10
**Date:** 2026-06-27
**Status:** ✅ Phase A + B + C + D + E + F COMPLETE — ALL Daily Tools shipped. 7 new AI tools (Email/Documents/Reports/Query/Explain/Context/Chat) live. Backend ready for deploy.
**Audience:** Engineering, product, planning

---

## 1. Decisions Locked

### ✅ Section 1.5 Google Sign-In — IMPLEMENTED

| Item | Status | Notes |
|---|---|---|
| `User.googleId` + `User.googlePicture` fields | ✅ Done | Schema updated, migration created |
| `passwordHash` optional (null for Google users) | ✅ Done | Allows passwordless Google accounts |
| `GoogleSignInDto` | ✅ Done | `backend/src/modules/auth/dto/google-signin.dto.ts` |
| `GoogleSignInInput` interface | ✅ Done | Added to `auth.interface.ts` |
| `IAuthService.googleSignIn()` | ✅ Done | Interface updated |
| `AuthService.googleSignIn()` | ✅ Done | Link existing OR create new user+tenant |
| `POST /auth/google` endpoint | ✅ Done | Verifies via Google tokeninfo endpoint |
| `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` env vars | ✅ Done | Added to `.env.example` |
| Frontend `googleSignIn()` in auth.service.ts | ✅ Done | Sends id_token to backend |
| Login page `Continue with Google` button | ✅ Done | GIS loaded via script tag, no npm package |
| Admin portal — no Google button | ✅ Done | Email/password only |
| Token verification approach | ✅ Done | `oauth2.googleapis.com/tokeninfo?id_token=` (no `google-auth-library` needed) |
| Auto-provision tenant for new Google users | ✅ Done | Creates tenant with default tier |
| Default tier lookup | ✅ Done | `prisma.tier.findFirst({ where: { isDefault: true }})` |

**Files created/modified:**
```
backend/prisma/schema.prisma                              (+googleId, googlePicture, passwordHash?, IntegrationCredential)
backend/prisma/migrations/20260626_add_google_signin/     (Week 0 migration)
backend/prisma/migrations/20260626_integration_credentials/ (Week 1 migration)
backend/src/modules/auth/dto/google-signin.dto.ts          (Week 0)
backend/src/modules/auth/interfaces/auth.interface.ts     (Week 0)
backend/src/modules/auth/services/auth.service.ts          (Week 0)
backend/src/modules/auth/controllers/auth.controller.ts    (Week 0)
backend/src/modules/integrations/                          (Week 1-4 - NEW module)
backend/src/modules/integrations/integrations.module.ts   (Week 1)
backend/src/modules/integrations/integrations.service.ts   (Week 1)
backend/src/modules/integrations/integrations.controller.ts (Week 1)
backend/src/modules/integrations/dto/integration.dto.ts    (Week 1)
backend/src/modules/integrations/services/integration-credential.store.ts (Week 3)
backend/src/modules/integrations/brevo/brevo-email.service.ts (Week 4)
backend/src/app.module.ts                                 (+IntegrationsModule)
backend/.env.example                                      (+GOOGLE_*, BREVO_API_KEY)
frontend-tenant/.env.example                              (+NEXT_PUBLIC_GOOGLE_CLIENT_ID)
frontend-tenant/.env.production                           (+NEXT_PUBLIC_GOOGLE_CLIENT_ID)
frontend-tenant/src/services/auth.service.ts             (Week 0)
frontend-tenant/src/services/integrations.service.ts     (Week 1)
frontend-tenant/src/app/login/page.tsx                   (Week 0)
frontend-tenant/src/app/settings/integrations/page.tsx (Week 1)
frontend-tenant/src/app/settings/integrations/callback/google/page.tsx (Week 2)
```

**Pending deploy steps:**
1. ~~`npx prisma migrate deploy` on Contabo (both migrations)~~ ✅ Applied (Sessions 6 + 7)
2. ~~Add `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` + `GOOGLE_REDIRECT_URI` + `BREVO_API_KEY` to Contabo backend `.env`~~ ✅ Done (Session 6)
3. ⚠️ Set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel dashboard for tenant frontend — **MANUAL STEP REQUIRED**
4. ~~Deploy backend to Contabo (`npm run build` + restart)~~ ✅ Done (Sessions 6 + 7)

### Blockers / Remaining Issues

| Issue | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` not in Vercel dashboard | 🔴 Open | Must be set manually in Vercel project settings for `neurecorebase-tenant` |
| `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/ BREVO key on Contabo | ✅ Done | Added to `.env` on Contabo in Session 6 |

### 1.1 NocoBase — Not Adopted as Core Dependency

**Decision:** NocoBase will NOT become part of NeureCore's core architecture.

**Rationale:**
- Two applications (NeureCore + NocoBase) sharing Postgres/Redis still means two products to maintain
- Authentication ownership handed to NocoBase creates unacceptable coupling
- CRM/ERP absorption conflicts with NeureCore's mission as AI agent platform
- Operational complexity of dual upgrade cycles, dual RBAC, dual API surfaces

**When NocoBase MAY be reconsidered:**
- Phase 3+ when specific high-effort capabilities (approval workflows, low-code forms) are confirmed needed
- Customers request configurable internal business apps as a add-on
- Engineering bandwidth exists to manage the added complexity

**Architecture going forward:**
```
NeureCore (own it)
├── Authentication & Identity
├── RBAC (8 roles)
├── AI Agents
├── Workflows / Tasks / Routines
├── Marketplace
├── Service Desk
├── Finance
└── Public APIs
         │
         ▼ (optional, later)
NocoBase (bounded extension, not dependency)
├── Internal admin tools
├── Dynamic forms
├── Approval workflows
└── Customer-specific low-code extensions
```

---

### 1.2 Daily Tools Strategy — Build AI-First, Not Feature-Complete

**Decision:** Build the 5-6 tools every business uses daily, with AI baked in. Leave specialized domains to best-in-class integrations.

| Tool | Priority | AI Differentiator | Build vs Integrate |
|---|---|---|---|
| **Email** | Phase 2 | AI reads, summarizes, drafts, prioritizes | Build via Google OAuth |
| **Reports/Dashboards** | Phase 2 | AI generates narratives from data, not just charts | Build (already have data) |
| **Data Tables** | Phase 3 | AI queries in plain English, explains data | Build on existing DB |
| **Documents** | Phase 3 | AI drafts, reviews, extracts from templates | Build |
| **Internal Chat** | Phase 3 | AI answers questions from company context | Build in-app |
| **PDF Generation** | Phase 2 | AI generates from data + templates | Build server-side |

**What we DON'T build (integrate instead):**
- Full CRM → Integrate with HubSpot/Salesforce via API
- ERP → Integrate with QuickBooks via API
- Video conferencing → Jitsi (embed, free) or Google Meet (when Workspace connected)
- Social media management → Native integrations with Meta/LinkedIn/Twitter APIs

---

### 1.3 Google Workspace Integration — Free Tier First

**Decision:** Google Workspace (free personal Gmail account) covers email/docs/sheets/calendar for startup customers at no cost. Paid Google Workspace is an optional upgrade.

**What works with FREE personal Gmail:**
| Google Service | API Access | Notes |
|---|---|---|
| Google Drive | ✅ Read/write | Files and folders |
| Google Docs | ✅ Read/write | Documents |
| Google Sheets | ✅ Read/write | Spreadsheets |
| Google Calendar | ✅ Read/write | Events |
| Gmail | ✅ Read/send | Via OAuth |
| Google Forms | ✅ Read responses | Via API |

**What requires PAID Google Workspace:**
| Service | Why needed |
|---|---|
| Custom domain email (`user@company.com`) | Personal Gmail addresses only |
| Google Meet | Workspace feature |
| Shared Drives | Team collaboration folder |
| Admin console | Organization management |

**Architecture:**
```
NeureCore MVP (Free — Day 1)
├── Email: Gmail OAuth (user's personal Gmail)
│            OR Brevo SMTP (agent email aliases)
├── Documents: Google Docs (personal Gmail)
│                OR Markdown in NeureCore storage
├── Spreadsheets: Google Sheets (personal Gmail)
│                   OR NeureCore Tables
├── Calendar: Google Calendar (personal Gmail)
├── PDF: Server-side generation (puppeteer/pdfkit)
├── Forms: NeureCore Forms (built-in)
└── Chat: In-app messaging (built-in)

Google Workspace Paid Add-on (Later)
├── Custom domain email per agent
├── Google Meet integration
├── Shared Drives for team collaboration
└── Full Workspace AI features
```

---

### 1.4 Per-Agent Aliases — Day 1 Feature

**Decision:** Every AI agent has its own email identity (`sales-agent@company.com`) from launch. This is not tied to Google Workspace — it's tied to Brevo (free SMTP relay) or user's personal Gmail.

**Why this matters:**
- Clients see different AI agents as different senders
- Each agent maintains its own communication thread
- Clear accountability: "which agent did this"
- Agents can have different tones, signatures, branding

**Email stack:**
```
Agent composes email
       ↓
Brevo SMTP relay (free: 300 emails/day)
       ↓
Recipient sees: from sales-agent@company.com
```

| Free Tier | Limit | Cost |
|---|---|---|
| Brevo (Sendinblue) | 300 emails/day | Free |
| Mailgun | 500 emails/month | Free tier |
| AWS SES | 62,000 emails/month | Free for new AWS |

**Per-agent alias per tier:**
| Agent | Email Alias | Drive Folder |
|---|---|---|
| Sales Agent | sales-agent@company.com | NeureCore/Sales Agent/ |
| HR Agent | hr-agent@company.com | NeureCore/HR Agent/ |
| Ops Agent | ops-agent@company.com | NeureCore/Ops Agent/ |
| Finance Agent | finance-agent@company.com | NeureCore/Finance Agent/ |

---

### 1.5 Google Sign-In — One-Click App Entry

**Decision:** "Continue with Google" is the primary signup/login option. Email + password is secondary. This reduces signup friction and automatically establishes Google identity for future workspace connections.

**Why:**
- Startup users already authenticated with Google
- Eliminates password creation + email verification step
- One click → account created + logged in + Google identity ready
- Faster time-to-value (seconds vs minutes)
- Mobile-friendly (no keyboard required for auth)

**Tenant Portal Login Page (`hq.neurecore.com`):**
```
┌─────────────────────────────────────────┐
│                                         │
│            [NeureCore Logo]             │
│                                         │
│     ┌─────────────────────────────┐     │
│     │   Continue with Google     │     │
│     │        [Google Icon]       │     │
│     └─────────────────────────────┘     │
│                                         │
│         ─── or ───                      │
│                                         │
│     ┌─────────────────────────────┐     │
│     │  Email                     │     │
│     └─────────────────────────────┘     │
│     ┌─────────────────────────────┐     │
│     │  Password                  │     │
│     └─────────────────────────────┘     │
│                                         │
│         [Sign In]                       │
│                                         │
│     Don't have an account? Sign up      │
│                                         │
└─────────────────────────────────────────┘
```

**Admin Portal Login Page (`cc.neurecore.com`):**
```
┌─────────────────────────────────────────┐
│                                         │
│            [NeureCore Logo]             │
│              Admin Portal                │
│                                         │
│     ┌─────────────────────────────┐     │
│     │  Email                     │     │
│     └─────────────────────────────┘     │
│     ┌─────────────────────────────┐     │
│     │  Password                  │     │
│     └─────────────────────────────┘     │
│                                         │
│         [Sign In]                       │
│                                         │
│     Internal credentials only.           │
│     Google Sign-In not available.        │
│                                         │
└─────────────────────────────────────────┘
```

**Signup Page (Same UX — collapsed by default):**
```
┌─────────────────────────────────────────┐
│                                         │
│            [NeureCore Logo]             │
│                                         │
│     ┌─────────────────────────────┐     │
│     │   Continue with Google      │     │
│     │        [Google Icon]       │     │
│     └─────────────────────────────┘     │
│                                         │
│         ─── or ───                      │
│                                         │
│     [Expand: Create with email]         │
│                                         │
│     Already have an account? Sign in     │
│                                         │
└─────────────────────────────────────────┘
```

**Google Sign-In Flow (Same Google OAuth, different scope):**
```
User clicks "Continue with Google"
       ↓
Google OAuth popup (consent screen)
       ↓
NeureCore receives: id_token (contains email, name, picture)
       ↓
Check: Does email exist in our DB?
  → YES: Log user in (link Google identity)
  → NO:  Create account + tenant + log in
       ↓
Prompt: "Connect Google Workspace for your agents?"
  → Skip (later in Settings)
  → Connect (initiates Google integration flow)
       ↓
Redirect to /onboarding (plan selection)
```

**Google Sign-In vs Google Workspace Integration:**

| Aspect | Google Sign-In | Google Workspace Integration |
|---|---|---|
| **Purpose** | User authentication | AI agent capabilities |
| **Scope** | `email`, `profile`, `openid` | Gmail, Drive, Calendar, Sheets |
| **When** | Login/signup (always) | Optional, post-onboarding |
| **Who** | Human users (tenant portal only) | AI agents acting on behalf of user |
| **Portals** | Tenant portal (`hq.neurecore.com`) ONLY | Tenant portal |
| **Admin Portal** | ❌ NOT available | N/A |

**Important:** Admin portal (`cc.neurecore.com`) uses ONLY internal email/password credentials. Google Sign-In is exclusively for the tenant portal.

**Backend Implementation:**
```typescript
// POST /api/v1/auth/google
@Post('auth/google')
async googleSignIn(@Body() dto: GoogleSignInDto) {
  const { idToken } = dto;

  // Verify with Google
  const ticket = await client.verifyIdToken({
    idToken,
    audience: GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();

  // Check if user exists
  const existingUser = await this.usersService.findByEmail(payload.email);

  if (existingUser) {
    // Link Google identity if not already linked
    if (!existingUser.googleId) {
      await this.usersService.linkGoogle(existingUser.id, payload.sub);
    }
    return this.authService.generateTokens(existingUser);
  }

  // Create new user + tenant
  const user = await this.authService.registerWithGoogle({
    email: payload.email,
    firstName: payload.given_name,
    lastName: payload.family_name,
    googleId: payload.sub,
    googlePicture: payload.picture,
  });

  return this.authService.generateTokens(user);
}
```

**Database Addition:**
```prisma
model User {
  // ... existing fields
  googleId       String?   @unique  // Google OAuth subject ID
  googlePicture  String?            // Profile picture URL
}
```

**Google Credentials (from Google Cloud Console — values stored in `.env`):**
```env
GOOGLE_CLIENT_ID=<your-google-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-google-client-secret>
```

**Post-Sign-In Google Workspace Prompt:**
```
┌─────────────────────────────────────────┐
│  Welcome, Sarah! 🚀                    │
├─────────────────────────────────────────┤
│  Your AI team is ready. Connect       │
│  Google Workspace to give your         │
│  agents email, docs, and calendar.     │
│                                         │
│  ┌─────────────────────────────┐       │
│  │   Connect Google Workspace  │       │
│  └─────────────────────────────┘       │
│                                         │
│  [Skip for now]                        │
│                                         │
└─────────────────────────────────────────┘
```

---

### 1.6 Onboarding — Tier + Template Auto-Deploy

**Decision:** Onboarding deploys pre-configured departments and agents based on selected plan + template. User reviews and customizes, but doesn't start from scratch.

**Flow:**
```
Step 1: Sign Up (Google Sign-In or Email)
    → Continue with Google (1 click)
    → OR Email + password

Step 2: Connect Google Workspace (Optional, skippable)
    → "Give agents access to Gmail, Drive, Calendar"
    → Skip or Connect

Step 3: Choose Plan
    → STARTER (3 agents, 1 department)
    → GROWTH (10 agents, 3 departments)
    → PRO (25 agents, 5 departments)
    → ENTERPRISE (unlimited)

Step 4: Select Department Template
    → Sales Team (Sales + Marketing + Support)
    → Operations (Ops + Finance)
    → Full Stack (5 departments)
    → Custom

Step 5: Review & Customize
    → See deployed departments and agents
    → Rename departments/agents
    → Move agents between departments
    → Add/remove within tier limits

Step 6: Invite Team
    → Add colleagues
    → Assign roles

Step 7: Dashboard
    → Fully functional platform
    → Integrations in Settings anytime
```

**Auto-deploy behavior:**
```
User picks: GROWTH + Sales Team template
                    ↓
System deploys:
┌─────────────────────────────────────────┐
│  GROWTH Plan (max: 10 agents, 3 depts) │
├─────────────────────────────────────────┤
│  📂 Sales (from template)
│     ├── Sales Agent
│     ├── Marketing Agent
│     └── Support Agent
│  📂 Operations (from template)
│     └── Ops Agent
│  Agents used: 4 / 10
│  Departments used: 2 / 3
└─────────────────────────────────────────┘
```

**Tier limits enforced at every step:**
- Cannot add more agents than plan allows
- Cannot add more departments than plan allows
- Upgrade prompt when limit reached

---

### 1.7 Integration Settings — Post-Onboarding Discovery

**Decision:** External integrations are accessible only after onboarding is complete. They are not requirements to get started.

**Route:** `/settings/integrations`

**Integration cards:**
```
┌─────────────────────────────────────────┐
│  Google Workspace           [Not Set]   │
│  Gmail, Drive, Calendar, Sheets          │
│  [Connect]                              │
├─────────────────────────────────────────┤
│  Email Relay (Brevo)      [Not Set]    │
│  Agent email aliases                    │
│  [Connect]                              │
├─────────────────────────────────────────┤
│  Slack                     [Coming Soon] │
│  Team notifications                      │
│  [Notify Me]                            │
├─────────────────────────────────────────┤
│  Microsoft 365         [Coming Soon]   │
│  Outlook, OneDrive, Teams               │
│  [Notify Me]                            │
└─────────────────────────────────────────┘
```

**Post-onboarding prompt (non-blocking):**
```
┌─────────────────────────────────────────┐
│  Supercharge your agents               │
├─────────────────────────────────────────┤
│  Connect Google Workspace to enable:   │
│  📧 Gmail  📁 Drive  📅 Calendar  📊 Sheets
│  This is optional. Agents work        │
│  internally even without connections.  │
│  [Connect Google]      [Maybe Later]  │
└─────────────────────────────────────────┘
```

---

## 2. Implementation Phases

### Phase A: Integration SDK Foundation + Google Sign-In (Weeks 1-4)

**Goal:** Build the infrastructure that all future integrations depend on. Add Google Sign-In as the primary auth option.

| Week | Backend | Frontend |
|---|---|---|
| **0** | **✅ Google Sign-In — DONE** | **✅ Login "Continue with Google" button — DONE** |
| **1** | **✅ Integration module skeleton — DONE** | **✅ Settings page structure — DONE** |
| **2** | **✅ Google OAuth flow (backend) — DONE** | **✅ OAuth callback handler (frontend) — DONE** |
| **3** | **✅ Encrypted credential storage — DONE** | **✅ Integration cards UI — DONE** |
| **4** | **✅ Brevo SMTP integration — DONE** | **✅ Email alias configuration — DONE** |
| **5-6** | **✅ Gmail: read inbox + send — DONE** | **✅ Agent email composer — DONE** |
| **7-8** | **✅ Calendar: view/create events — DONE** | **✅ Calendar widget — DONE** |
| **9-10** | **✅ Drive: folder per agent — DONE** | **✅ Drive file browser — DONE** |

**Backend Module Structure:**
```
backend/src/modules/
├── auth/
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── strategies/
│   │   ├── jwt.strategy.ts
│   │   ├── local.strategy.ts
│   │   └── google.strategy.ts     # NEW: Google Sign-In
│   └── dto/
│       └── google-signin.dto.ts   # NEW: id_token validation
│
└── integrations/
    ├── integrations.module.ts
    ├── integrations.controller.ts     # CRUD for connections
    ├── integrations.service.ts         # Unified credential management
    ├── dto/
    │   ├── connect-google.dto.ts
    │   └── connect-brevo.dto.ts
    ├── google/
    │   ├── google.auth.ts            # OAuth flow (Workspace)
    │   ├── google.drive.ts          # Folder creation
    │   ├── google.gmail.ts          # Email operations
    │   ├── google.calendar.ts        # Calendar operations
    │   └── google.sheets.ts          # Spreadsheet operations
    └── brevo/
        └── brevo.smtp.ts            # Email relay
```

**Database Model:**
```prisma
model IntegrationCredential {
  id            String    @id @default(uuid())
  tenantId      String
  provider      String    # 'google' | 'brevo' | 'slack' | 'microsoft'
  credentials   Json      # Encrypted access/refresh tokens, API keys
  scopes        String[]  # ['gmail.read', 'drive.write', ...]
  status        String    # 'active' | 'expired' | 'revoked'
  lastSyncAt    DateTime?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([tenantId, provider])
}
```

---

### Phase B: Google Integration — Core (Weeks 5-10)

**Goal:** Full Google Workspace integration via free personal Gmail OAuth.

| Week | Backend | Frontend |
|---|---|---|
| 5-6 | Gmail: read inbox, send emails | Agent email composer UI |
| 7-8 | Google Calendar: view/create events | Calendar widget |
| 9-10 | Google Drive: folder creation per agent | Drive file browser |

**Agent Folder Structure (auto-created on integration connect):**
```
User's Google Drive
└── NeureCore (root folder, created once)
    └── [Agent Name]
        ├── 📧 Drafts
        ├── 📄 Documents
        ├── 📊 Reports
        ├── 📋 Templates
        └── 📁 Archive
```

**Implementation:**
```typescript
// Auto-create folders when agent is created
async function setupAgentGoogleFolders(agent: Agent, credentials: any) {
  const drive = google.drive({ credentials });

  // Create root NeureCore folder (once per tenant)
  const rootFolder = await drive.files.create({
    name: 'NeureCore',
    mimeType: 'application/vnd.google-apps.folder',
  });

  // Create agent folder
  const agentFolder = await drive.files.create({
    name: agent.name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [rootFolder.data.id],
  });

  // Create subfolders
  for (const subfolder of ['Drafts', 'Documents', 'Reports', 'Templates', 'Archive']) {
    await drive.files.create({
      name: subfolder,
      mimeType: 'application/vnd.google-apps.folder',
      parents: [agentFolder.data.id],
    });
  }

  return agentFolder.data.id;
}
```

---

### Phase C: Email Agent (Weeks 11-14) — ✅ COMPLETE 2026-06-27

**Goal:** AI agent can read, summarize, draft, and send emails via Gmail API or Brevo SMTP.

| Week | Feature | Status | Implementation |
|---|---|---|---|
| 11 | Email read | ✅ Done | `EmailTool` action=`read_inbox` + `get_message` via `GoogleGmailService` |
| 12 | Email compose | ✅ Done | `EmailTool` action=`send` with `to/subject/body`; agent's LLM drafts, user reviews via tool result |
| 13 | Email send | ✅ Done | Provider routing: `Agent.emailProvider` (gmail\|brevo), alias from `Agent.emailAlias`, falls back to Brevo. Sends via `BrevoEmailService` (SMTP relay) or `GoogleGmailService` (API). |
| 14 | Priority flagging | ✅ Done | `EmailTool` action=`flag` applies Gmail labels (IMPORTANT/STARRED). AI agent's reasoning decides what to flag based on message content + system prompt. |

**Email tool for agents (Phase C — IMPLEMENTED):**
```typescript
// backend/src/modules/tools/built-in/email.tool.ts
@Injectable()
export class EmailTool extends BaseStructuredTool {
  readonly name = 'email';
  readonly category = ToolCategory.COMMUNICATION;
  readonly requiredPermissions = ['email:read', 'email:send'];

  protected async executeImpl(input: EmailInput, context?: ToolExecutionContext) {
    switch (input.action) {
      case 'read_inbox': return this.gmail.listInbox(tenantId, { maxResults, q });
      case 'get_message': return this.gmail.getMessageBody(tenantId, messageId);
      case 'send':        return this.send(tenantId, input, context);
      case 'flag':        return this.flag(tenantId, input); // applies Gmail labels
    }
  }

  private async resolveSender(tenantId, agentId, requested) {
    // Picks Gmail or Brevo based on Agent.emailProvider + which is connected
    // Uses Agent.emailAlias as From address; falls back to `<slug>-agent@neurecore.app`
  }
}
```

**Database (Phase C migration):**
```prisma
model Agent {
  // ... existing fields
  emailAlias        String?  // sales-agent@company.com
  emailProvider     String?  @default("brevo") // 'brevo' | 'gmail'
  emailDisplayName  String?  // "Sales Agent"
}
```

**Files created/modified (Phase C):**
```
backend/prisma/schema.prisma                                    (+emailAlias, emailProvider, emailDisplayName)
backend/prisma/migrations/20260627_agent_email_alias/           NEW migration
backend/src/modules/tools/built-in/email.tool.ts                NEW EmailTool (4 actions)
backend/src/modules/tools/tools.module.ts                       (+IntegrationsModule import via forwardRef, +EmailTool provider/registration)
```

**Pending deploy steps (Phase C):**
1. ⚠️ `npx prisma migrate deploy` on Contabo — apply `20260627_agent_email_alias`
2. ⚠️ Deploy backend to Contabo (`npm run build` + restart) — Phase C
3. ✅ Per-agent email alias already used by Phase C EmailTool. UI to expose alias config not yet built (out of Phase C scope).

**AI priority flagging model (Phase C — design):**
- Tool persists labels mechanically via `flag` action
- The agent's LLM reasoning loop (LangGraph state machine) decides urgency based on message content + agent system prompt
- Hybrid: tool = persistence, agent = decision

---

### Phase D: Documents & Reports (Weeks 15-20) — ✅ COMPLETE 2026-06-27

**Goal:** AI agent creates documents, generates reports, exports to PDF.

| Week | Feature | Status | Implementation |
|---|---|---|---|
| 15-16 | Document creation | ✅ Done | `DocumentsTool` action=`create` writes HTML/plaintext into agent's `NeureCore/<Agent>/Documents/` Drive folder |
| 15-16 | Document list/read | ✅ Done | `DocumentsTool` action=`list` + `read` (uses Drive export API for Google Docs) |
| 17-18 | Report generation | ✅ Done | `ReportsTool` action=`generate` aggregates Prisma data, builds styled HTML with tables + bars, optionally injects AI narrative |
| 19-20 | PDF export | ✅ Done | Drive-native PDF export via `export?mimeType=application/pdf` (no extra deps). Frontend can also browser-print the HTML output. |

**Report generation flow (implemented):**
```
User asks: "Show me Q2 pipeline by region"
       ↓
Agent calls: reports(action='generate', type='pipeline_overview', narrative=...)
       ↓
ReportsTool queries: Prisma aggregations (groupBy + aggregate on tasks, costs, agents)
       ↓
ReportsTool renders: Styled HTML report with tables + bar visualizations
       ↓
Saves to Drive: NeureCore/<Agent>/Reports/<title>-<date>.html (auto-converts to Doc)
       ↓
Optional: agent calls reports(action='export_pdf', fileId=...) → PDF via Drive export API
       ↓
Optional: agent calls email(action='send', ...) with PDF attached/narrative body → Brevo SMTP
```

**Report types supported:**
- `task_summary` — status/priority breakdown, overdue list, recently completed
- `cost_summary` — total + per-department + top-10 agents by cost
- `agent_workload` — active agents + active task counts (rendered as bar chart)
- `pipeline_overview` — pipeline by stage + recent tasks + top performers

**Files created (Phase D):**
```
backend/src/modules/tools/built-in/documents.tool.ts     NEW — 3 actions (create/list/read)
backend/src/modules/tools/built-in/reports.tool.ts       NEW — 2 actions (generate/export_pdf)
backend/src/modules/tools/tools.module.ts                (+DocumentsTool, +ReportsTool registered)
```

**Why HTML (not raw PDF):**
- No PDF library installed — keeps backend deps lean
- HTML is renderable directly in the agent chat UI
- Browser print-to-PDF is one click away for the user
- Drive upload of HTML renders natively as a Doc; Drive's export API gives PDF
- AI narrative injected as a styled section; agent's LLM supplies the prose after reviewing the data

---

### Phase E: Data Tables + Plain English Queries (Weeks 21-24) — ✅ COMPLETE 2026-06-27

**Goal:** Users query company data in natural language. AI translates to SQL, explains results.

| Week | Feature | Status | Implementation |
|---|---|---|---|
| 21-22 | NL to SQL | ✅ Done | `QueryTool` — LLM produces a structured JSON query plan; tool validates against an allow-list, then executes via Prisma |
| 23-24 | Data explanation | ✅ Done | `ExplainTool` — takes query results + audience, returns structured summary + key insights + recommendations |

**Query flow (implemented):**
```
User asks: "How many overdue critical tasks do we have this week?"
       ↓
Agent calls: query(action='ask', question=...)
       ↓
QueryTool:
  1. LLM (LLMFactory.invoke) translates NL → JSON query plan
  2. Plan validated: entity ∈ {task, agent, dept, project, user, costRecord}
  3. Filters validated: field ∈ allow-list, op ∈ {eq, neq, gt, ...}
  4. tenantId force-injected into where clause
  5. Plan executed via Prisma → rows + count + duration
       ↓
Agent calls: explain(action='explain_aggregation', aggregation={count:N}, question=...)
       ↓
ExplainTool: LLM writes summary + insights + recommendations
       ↓
Agent narrates explanation to the user
```

**Files created (Phase E):**
```
backend/src/modules/tools/built-in/query.tool.ts         NEW — 3 actions (translate/execute/ask)
backend/src/modules/tools/built-in/explain.tool.ts       NEW — 2 actions (explain_rows/explain_aggregation)
backend/src/modules/tools/tools.module.ts                (+QueryTool, +ExplainTool, +ModelsModule import)
```

**Security model:**
1. Entity allow-list: only `task`, `agent`, `department`, `project`, `user`, `costRecord` are queryable
2. Field allow-list per entity (no arbitrary columns)
3. Operator allow-list: `eq, neq, gt, gte, lt, lte, in, contains`
4. `tenantId` force-injected into every where clause — cross-tenant reads impossible
5. `limit` capped at 200 rows
6. No writes — only `findMany` / `aggregate`
7. LLM output JSON-parsed + Zod-validated before execution; invalid plan → error
8. Aggregation requires explicit `aggregateField` in allow-list

**Phase E no deploy steps required beyond Phase C/D backend rebuild (LLMFactory is already in ModelsModule — just register the new tools).**

---

### Phase F: Internal AI Chat (Weeks 25-28) — ✅ COMPLETE 2026-06-27

**Goal:** Team members ask AI questions, get answers from company context (docs, data, history).

| Week | Feature | Status | Implementation |
|---|---|---|---|
| 25-26 | Context awareness | ✅ Done | `ContextTool` — 4 actions: `search_memory` (vector+keyword), `load_drive` (Google Drive docs), `load_history` (prior turns by topic), `load_all` (bundle) |
| 27-28 | Multi-turn conversations | ✅ Done | `ChatTool` — 2 actions: `ask` (LLM with assembled context), `remember` (explicit memory write). Turns persist as `MemoryEntry` rows with `metadata.conversationTopic` so future agents find them via the same vector search |

**Internal AI Chat flow (implemented):**
```
Teammate asks: "What did we decide about Q3 pricing last week?"
       ↓
Agent calls: chat(action='ask', question=..., topic='q3-pricing')
       ↓
ChatTool:
  1. Parallel context load (via ContextTool):
     - MemoryService.search → vector+keyword matches for "Q3 pricing"
     - load_history(topic='q3-pricing') → prior turns on this topic
     - load_drive(Documents) → snippets of pricing docs (optional)
  2. Assemble system prompt with cited context blocks (capped at 4000 chars)
  3. LLMFactory.invoke → answer
  4. Persist:
     - MemoryEntry(question, role='user', topic='q3-pricing')
     - MemoryEntry(answer, role='assistant', topic='q3-pricing', inReplyTo=userId)
  5. Return answer + contextUsed stats + storedTurnId
       ↓
Future question on 'q3-pricing' → context.load_history + context.search_memory
       find these turns → next teammate gets continuity
```

**Files created (Phase F):**
```
backend/src/modules/tools/built-in/context.tool.ts     NEW — 4 actions (search_memory/load_drive/load_history/load_all)
backend/src/modules/tools/built-in/chat.tool.ts         NEW — 2 actions (ask/remember)
backend/src/modules/tools/tools.module.ts               (+ContextTool, +ChatTool, +MemoryModule import)
```

**Design decisions:**
- **Two-tool split** (Context vs Chat) keeps read-vs-write separated and each tool single-purpose
- **Persistence via existing MemoryService** — no new schema; uses `type=LONG_TERM` + `metadata.conversationTopic`/`role`
- **Drive load is optional** in chat — adds latency; only when user explicitly requests document context
- **Context size cap (4000 chars default)** — prevents token blowup on long conversations
- **Snippet truncation (800 chars per memory, 1500 per history turn)** — keeps LLM prompt bounded
- **`topic` parameter** is the conversation key — same topic = same thread across teammates

**Phase F no migration required (uses existing MemoryEntry schema). Backend rebuild registers all tools.**

---

## Final Status (2026-06-27)

All six phases of the Daily Tools & Integration Plan shipped:

| Phase | Weeks | Tools Shipped | Status |
|---|---|---|---|
| A | 0-4 | Google Sign-In, IntegrationsModule, Gmail, Calendar, Drive folders, Brevo SMTP | ✅ Live (Sessions 6-8) |
| B | 5-10 | Phase A integrations (Gmail read/send, Calendar, Drive folder per agent) | ✅ Live (Sessions 6-8) |
| C | 11-14 | EmailTool (4 actions) | ✅ Backend ready for deploy |
| D | 15-20 | DocumentsTool (3 actions), ReportsTool (2 actions) | ✅ Backend ready for deploy |
| E | 21-24 | QueryTool (3 actions), ExplainTool (2 actions) | ✅ Backend ready for deploy |
| F | 25-28 | ContextTool (4 actions), ChatTool (2 actions) | ✅ Backend ready for deploy |

Total: **7 new AI tools** (18 actions) registered across Phases C–F, plus the 72-tool P1 library = **79 tools total**.

**Deploy steps remaining (all phases C–F):**
1. ⚠️ `npx prisma migrate deploy` on Contabo — apply `20260627_agent_email_alias` (only Phase C needs this)
2. ⚠️ Rebuild + restart backend on Contabo — registers all 9 new tools
3. (Optional) `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel dashboard (pending from Session 6)

---

## 3. Integration Settings Page Design

### 3.1 Settings Page (`/settings/integrations`)

```
┌─────────────────────────────────────────────────────────┐
│  Settings > Integrations                                │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Connected                                              │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🔵 Google Workspace                             │  │
│  │  connected@company.com                         │  │
│  │  Gmail · Drive · Calendar · Sheets            │  │
│  │  Last synced: 2 minutes ago         [Manage]   │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🟠 Brevo (Email Relay)                          │  │
│  │  Not connected                    [Connect]     │  │
│  │  Enables agent email aliases                     │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  Available Integrations                                 │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🟢 Slack (Coming Soon)                          │  │
│  │  Team notifications and alerts                   │  │
│  │                                      [Notify Me] │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │ 🔴 Microsoft 365 (Coming Soon)                   │  │
│  │  Outlook, OneDrive, Teams                        │  │
│  │                                      [Notify Me] │  │
│  └─────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 Manage Google Modal

```
┌────────────────────────────────────────┐
│  Google Workspace                   [X]│
├────────────────────────────────────────┤
│  Account: john@gmail.com               │
│                                        │
│  ☑ Gmail    (read, compose, send)    │
│  ☑ Google Drive (read, write files)   │
│  ☑ Google Calendar (read, write)      │
│  ☑ Google Sheets (read, write)        │
│                                        │
│  Connected folders:                    │
│  └── NeureCore/                       │
│       ├── Sales Agent/                │
│       ├── Marketing Agent/            │
│       └── Ops Agent/                   │
│                                        │
│  [Disconnect Google]                   │
└────────────────────────────────────────┘
```

### 3.3 Agent Integration Assignment (in agent edit page)

```
┌─────────────────────────────────────────┐
│  Agent: Sales Agent                    │
├─────────────────────────────────────────┤
│  Google Services                       │
│  ☑ Gmail    → sales-agent@company.com │
│  ☑ Drive    → NeureCore/Sales Agent  │
│  ☑ Calendar → sales-agent@company.com │
│  ☐ Sheets   → Sales Data              │
│                                        │
│  Email Alias                           │
│  From: sales-agent@company.com (Brevo) │
│                                        │
│  Permissions                           │
│  ☑ Can send emails                     │
│  ☐ Can create documents               │
│  ☐ Can read Drive files               │
└─────────────────────────────────────────┘
```

---

## 4. SOLID Architecture for Integrations

### 4.1 Provider Pattern (Open/Closed Principle)

```typescript
// ✅ Add new providers without modifying existing code
interface EmailProvider {
  send(to: string, subject: string, body: string): Promise<void>;
  readInbox(maxResults: number): Promise<Email[]>;
}

class BrevoEmailProvider implements EmailProvider { ... }
class GmailEmailProvider implements EmailProvider { ... }

class EmailProviderFactory {
  static create(type: 'brevo' | 'gmail'): EmailProvider {
    switch (type) {
      case 'brevo': return new BrevoEmailProvider();
      case 'gmail': return new GmailEmailProvider();
    }
  }
}
```

### 4.2 Credential Abstraction (Interface Segregation)

```typescript
interface ICredentialStore {
  get(tenantId: string, provider: string): Promise<Credential>;
  set(tenantId: string, provider: string, credential: Credential): Promise<void>;
  revoke(tenantId: string, provider: string): Promise<void>;
}

interface IDriveService {
  createFolder(name: string, parentId?: string): Promise<Folder>;
  createFile(name: string, folderId: string, content: any): Promise<File>;
  listFiles(folderId: string): Promise<File[]>;
}
```

### 4.3 Agent Integration Registry (Dependency Inversion)

```typescript
@Injectable()
class AgentIntegrationRegistry {
  private integrations = new Map<string, IAgentIntegration>();

  register(name: string, integration: IAgentIntegration) {
    this.integrations.set(name, integration);
  }

  get(name: string): IAgentIntegration {
    return this.integrations.get(name);
  }

  getAll(): IAgentIntegration[] {
    return Array.from(this.integrations.values());
  }
}

// Each integration depends on abstraction, not concrete implementation
interface IAgentIntegration {
  name: string;
  enabled: boolean;
  tools: IStructuredTool[];
  credentials: CredentialRef;
}
```

---

## 5. Google OAuth Flow

### 5.1 Backend OAuth Handler

```typescript
// GET /api/v1/integrations/google/auth
@Get('google/auth')
async initiateGoogleAuth(@CurrentUser() user: AuthenticatedUser) {
  const scopes = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.send',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/spreadsheets',
  ];

  const url = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state: Buffer.from(JSON.stringify({ tenantId: user.tenantId })).toString('base64'),
  });

  return { url };
}

// GET /api/v1/integrations/google/callback
@Get('google/callback')
async handleGoogleCallback(
  @Query('code') code: string,
  @Query('state') state: string,
) {
  const { tenantId } = JSON.parse(Buffer.from(state, 'base64').toString());
  const { tokens } = await oauth2Client.getToken(code);

  // Store encrypted credentials
  await this.integrationsService.storeCredentials(tenantId, 'google', {
    accessToken: encrypt(tokens.access_token),
    refreshToken: encrypt(tokens.refresh_token),
    expiryDate: tokens.expiry_date,
  });

  return { success: true };
}
```

---

## 6. Brevo SMTP Setup

### 6.1 Backend Configuration

```typescript
// Environment variables
BREVO_API_KEY=your_brevo_api_key
BREVO_SMTP_URL=smtp-relay.brevo.com
BREVO_SMTP_PORT=587

// Email service
@Injectable()
export class BrevoEmailService {
  private api: TransactionalEmailsApi;

  async sendEmail(dto: SendEmailDto) {
    const email = new SendSmtpEmail();
    email.to = [{ email: dto.to }];
    email.subject = dto.subject;
    email.htmlContent = dto.body;
    email.sender = {
      email: dto.from, // e.g., sales-agent@company.com
      name: dto.fromName,
    };

    return this.api.sendTransacEmail(email);
  }
}
```

### 6.2 Agent Email Assignment

```typescript
// When creating/updating an agent
interface AgentEmailConfig {
  alias: string;      // sales-agent@company.com
  provider: 'brevo' | 'gmail';
  displayName: string;
  signature?: string;
}
```

---

## 7. Onboarding Architecture

### 7.1 Onboarding State Machine

```typescript
type OnboardingStep =
  | 'account'      // Email, password, subdomain
  | 'company'      // Company name, logo, industry
  | 'plan'         // Tier selection
  | 'template'     // Department template
  | 'review'       // Review & customize deployed resources
  | 'team'         // Invite members
  | 'complete';    // Done

interface OnboardingState {
  currentStep: OnboardingStep;
  company?: { name: string; logo?: string; timezone: string; currency: string };
  plan?: 'STARTER' | 'GROWTH' | 'PRO' | 'ENTERPRISE';
  template?: string;
  departments?: Department[];
  agents?: Agent[];
  integrations?: IntegrationCredential[];
  completedAt?: Date;
}
```

### 7.2 Tier Limits (enforced everywhere)

| Tier | Agents | Departments | Storage | API Calls |
|---|---|---|---|---|
| STARTER | 3 | 1 | 1 GB | 1,000/day |
| GROWTH | 10 | 3 | 10 GB | 5,000/day |
| PRO | 25 | 5 | 100 GB | 25,000/day |
| ENTERPRISE | Unlimited | Unlimited | 1 TB | Unlimited |

### 7.4 Redirect Rules

```
/ → (not logged in) → /login
/login → (Google Sign-In) → /onboarding (skip Step 1)
login → (Email) → /register → /onboarding
/login → (logged in + onboarding incomplete) → /onboarding
/login → (logged in + onboarding complete) → /dashboard
/onboarding → (complete) → /dashboard
/settings/integrations → (onboarding incomplete) → /onboarding
```

### 7.5 Google Sign-In UX States

**New User (No existing account):**
```
"Continue with Google" clicked
       ↓
Google consent (already approved)
       ↓
Account created (email, name, picture from Google)
       ↓
Tenant created (auto-generated from email domain)
       ↓
Logged in
       ↓
→ /onboarding (Step 2: Connect Google Workspace prompt)
```

**Existing User (Email exists, Google not linked):**
```
"Continue with Google" clicked
       ↓
Account found by email
       ↓
Google ID linked to account
       ↓
Logged in
       ↓
→ /dashboard (onboarding complete)
```

**Existing User (Google-linked account):**
```
"Continue with Google" clicked
       ↓
Google ID matched
       ↓
Logged in (no password needed)
       ↓
→ /dashboard (onboarding complete)
```

**Email User (Password login, existing account):**
```
Email + password
       ↓
Validated
       ↓
Logged in
       ↓
→ /dashboard (onboarding complete)
       OR → /onboarding (first time)
```

---

## 8. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Google Sign-In OAuth failure | Medium | Users can't login | Fallback to email/password; clear error message |
| Google Sign-In account linking confusion | Medium | User has two accounts | Prompt: "Link this Google account or sign in with different account?" |
| Google OAuth token expiry without refresh | Medium | Agent loses Google access | Store refresh token; auto-refresh on 401 |
| Brevo daily limit exceeded | Low | Emails queue/fail | Monitor daily count; warn at 80%; upgrade path |
| Gmail API rate limits | Medium | Agent throttled | Exponential backoff; per-user rate limiting |
| Agent folder proliferation | Low | Messy Drive | Root folder per tenant; cleanup job for deleted agents |
| Personal Gmail OAuth scope creep | Medium | Security concern | Minimal scopes for Sign-In; full scopes only for Workspace |
| Tenant isolation breach in integrations | Critical | Data leak | All integration queries include tenantId filter |

---

## 9. Out of Scope (v1)

- NocoBase integration (deferred)
- Microsoft 365 integration (Phase 2)
- Slack integration (Phase 2)
- Custom domain email without paid Google Workspace
- Video conferencing (Jitsi or Meet only)
- Social media management APIs
- Advanced CRM/ERP connectors
- Apple Sign-In (future option)
- GitHub OAuth (future option)

---

## 10. Success Metrics (v1)

| Metric | Target |
|---|---|
| Onboarding completion rate | >80% |
| Time to first agent task | <5 minutes |
| **Google Sign-In adoption** | >60% of new users |
| **Google Sign-In success rate** | >95% |
| Google Workspace integration success rate | >95% |
| Email delivery success (Brevo) | >98% |
| Agent folder creation success | 100% |
| Zero cross-tenant data access | 100% |
| Time to login (Google Sign-In) | <3 seconds |

---

**Document Status:** 🎉 ALL phases (A–F) shipped. Backend ready for deploy.

**Changelog (v1.10) — 2026-06-27:**
- ✅ Phase F: Internal AI Chat COMPLETE (Weeks 25-28)
- ✅ `ContextTool` shipped: 4 actions — `search_memory`, `load_drive`, `load_history`, `load_all`
- ✅ `ChatTool` shipped: 2 actions — `ask`, `remember`
- ✅ Multi-turn persistence: Q&A pairs stored as `MemoryEntry` with `metadata.conversationTopic`
- ✅ Context-assembly flow: memory matches + history + Drive snippets → bounded system prompt → LLM → answer + persistence
- ✅ ToolsModule now imports MemoryModule so tools can use MemoryService + ContextTool
- ✅ TypeScript: 0 errors in Phase F files
- ✅ All 6 phases complete — 7 new tools registered across 18 total actions: EmailTool(4), DocumentsTool(3), ReportsTool(2), QueryTool(3), ExplainTool(2), ContextTool(4), ChatTool(2)

**Changelog (v1.9) — 2026-06-27:**
- ✅ Phase E: Data Tables + NL Queries COMPLETE (Weeks 21-24)
- ✅ `QueryTool` shipped: 3 actions — `translate`, `execute`, `ask` (NL → structured query → Prisma)
- ✅ `ExplainTool` shipped: 2 actions — `explain_rows`, `explain_aggregation`
- ✅ Security: entity allow-list (6 entities), field allow-list, operator allow-list, tenantId force-injection, 200-row cap, read-only
- ✅ 6 queryable entities: `task`, `agent`, `department`, `project`, `user`, `costRecord`
- ✅ Aggregations: `count`, `sum`, `avg`, `min`, `max` over numeric fields
- ✅ ToolsModule now imports ModelsModule so tools can use LLMFactory.invoke
- ✅ TypeScript: 0 errors in Phase E files
- ✅ Phase E no migration required (no schema changes — tools use existing Prisma + LLMFactory)

**Changelog (v1.8) — 2026-06-27:**
- ✅ Phase D: Documents & Reports COMPLETE (Weeks 15-20)
- ✅ `DocumentsTool` shipped: 3 actions — `create`, `list`, `read` (uses Drive + Drive export API)
- ✅ `ReportsTool` shipped: 2 actions — `generate`, `export_pdf`
- ✅ 4 report types: `task_summary`, `cost_summary`, `agent_workload`, `pipeline_overview`
- ✅ HTML reports with embedded CSS, tables, bar charts, and AI-injectable narrative
- ✅ PDF export via Drive's native `export?mimeType=application/pdf` — no new npm deps
- ✅ Auto-saves reports to `NeureCore/<Agent>/Reports/` Drive folder (HTML → Doc conversion)
- ✅ Phase D no deploy steps required beyond Phase C backend rebuild (new tools register on startup)

**Changelog (v1.7) — 2026-06-27:**
- ✅ Phase C: Email Agent COMPLETE (Weeks 11-14)
- ✅ `EmailTool` shipped with 4 actions: `read_inbox`, `get_message`, `send`, `flag`
- ✅ Per-agent email identity: `Agent.emailAlias`, `emailProvider`, `emailDisplayName`
- ✅ Provider routing: Gmail API or Brevo SMTP, selected by `Agent.emailProvider` + connection state
- ✅ Priority flagging: hybrid LLM-decision + Gmail label persistence
- ✅ Migration `20260627_agent_email_alias` ready for deploy
- ✅ ToolsModule now imports IntegrationsModule (forwardRef) so tools can reach Gmail/Brevo services
- ✅ UI logo/favicon from `memory-bank/public/` deployed to `frontend-tenant/public/` and `frontend-admin/public/`
- ⚠️ Phase C deploy steps remaining: `prisma migrate deploy` + backend restart on Contabo

**Changelog (v1.6):**
- ✅ Google Sign-In FULLY IMPLEMENTED — 2026-06-26
- ✅ Phase A Weeks 0-4 ALL COMPLETE — 2026-06-26
- ✅ Phase B Weeks 5-10 ALL COMPLETE (Gmail + Calendar + Drive) — 2026-06-26
- ✅ Sessions 6 + 7 + 8: Full deployment to Contabo + Vercel
- ✅ Migration `20260626_add_google_signin` applied to Neon
- ✅ Migration `20260626_integration_credentials` applied to Neon
- ✅ Migration `20260627_google_workspace_ids` applied to Neon
- ✅ 17 new Gmail/Calendar/Drive endpoints mapped (confirmed in smoke tests)
- ✅ Vercel `rootDirectory` fixed to `frontend-tenant` (Session 8)
- ⚠️ `NEXT_PUBLIC_GOOGLE_CLIENT_ID` in Vercel dashboard — MANUAL STEP REQUIRED

**Changelog (v1.5):**
- ✅ Google Sign-In FULLY IMPLEMENTED — 2026-06-26
- ✅ Phase A Weeks 0-4 ALL COMPLETE — 2026-06-26

**Changelog (v1.4):**
- ✅ Google Sign-In FULLY IMPLEMENTED — 2026-06-26
- ✅ Phase A Weeks 0-4 ALL COMPLETE — 2026-06-26

**Changelog (v1.3):**
- ✅ Google Sign-In FULLY IMPLEMENTED — 2026-06-26
- ✅ Week 1 (Phase A): Integration module skeleton + settings page — 2026-06-26
- ✅ Week 2 (Phase A): Google OAuth flow + frontend callback page — 2026-06-26

**Changelog (v1.2):**

**Changelog (v1.1):**
