# Frontend-Tenant Quick Reference: Refactoring Checklist
## What's Done ✓ | What's Missing ❌ | Priority & Effort

---

## 🎯 CURRENT STATE SNAPSHOT

### ✅ Already Implemented

| Feature | File | Status | Date |
|---------|------|--------|------|
| Command Palette (Cmd+K) | `components/command-palette/CommandPalette.tsx` | ✓ Production-ready | — |
| Command Center (Landing) | `app/command-center/page.tsx` | ✓ Creatio-style | — |
| Icon Rail Sidebar | `components/layout/IconRail.tsx` | ✓ Modern & collapsed | — |
| Service Desk Hub | `app/service-desk/page.tsx` | ✓ Inbox + Approvals + Audit | — |
| Department Roster | `app/departments/page.tsx` | ✓ With org chart | — |
| Real-time Activity Stream | `components/layout/ActivityStream.tsx` | ✓ Live updates | — |
| Agent Card UI | `components/agent-card/AgentCard.tsx` | ✓ Visual design | — |
| Dark Mode | `tailwind.config.js` | ✓ Built-in | — |
| Zustand Stores | `stores/*.ts` | ✓ State management | — |
| Socket.IO Integration | `services/socket.ts` | ✓ Real-time ready | — |
| Creatio Components | `components/creatio/*.tsx` | ✓ KpiCard, StatusBadge | — |
| TypeScript Strict | `tsconfig.json` | ✓ Type-safe | — |
| **Command Cockpit Dashboard** | `app/command-cockpit/page.tsx` | ✓ **NEW** Complete | 2026-07-03 |
| **Risk-Stratified Approvals** | `components/approvals/*.tsx` | ✓ **NEW** Complete | 2026-07-03 |
| **Impact Timeline Dashboard** | `components/timeline/*.tsx` | ✓ **NEW** Complete | 2026-07-03 |
| **Cross-Dept Context & Dependencies** | `components/context/*.tsx` | ✓ **NEW** Complete | 2026-07-03 |
| **Comprehensive Mock Data** | `lib/mock-data.ts` | ✓ **NEW** Complete | 2026-07-03 |

### ❌ Remaining for Future Phases

| Feature | Priority | Files Needed | Effort |
|---------|----------|--------------|--------|
| **Batch Approval System** | 🔴 P0 | `BatchApprovalView.tsx` | 🟢 Low |
| **Agent Orchestration** | 🟡 P1 | `AgentOrchestrationBoard.tsx` | 🟡 Medium |
| **Feedback Loop & Learning** | 🟡 P1 | `LearningFeedbackModal.tsx` | 🟡 Medium |
| **Department Control Rooms** | 🟢 P2 | `ControlRoom.tsx` (per dept) | 🔴 High |

---

## 📋 PHASE 1: APPROVALS INTELLIGENCE (Week 1-2)

### What to Build

```
src/components/approvals/
├── ApprovalCard.tsx         ← Main card showing: title, risk, confidence, actions
├── RiskBadge.tsx            ← Visual: 🔴 CRITICAL, 🟠 HIGH, 🟡 MEDIUM, 🟢 LOW
├── ConfidenceScore.tsx      ← Visual: 87% with tooltip explaining why
├── EvidenceBox.tsx          ← Shows signals: ✓ Positive, ⚠ Unknown, ✗ Negative
├── SimilarDealsBox.tsx      ← "Past similar: 3 deals, 73% win rate"
├── ApprovalHub.tsx          ← Container: stratified list (HIGH RISK | ROUTINE)
└── FeedbackModal.tsx        ← "Help us learn why you rejected this"

src/app/service-desk/approvals-hub/
└── page.tsx                 ← NEW page showing ApprovalHub

src/stores/
├── approvalStore.ts         ← NEW: Zustand store for approval state
└── (update) agentStore.ts   ← Add approval confidence tracking
```

### Backend Requirements

```typescript
// ENDPOINT 1: GET /approvals/stratified?status=PENDING
{
  critical: [
    {
      id: "...",
      title: "Acme Corp proposal",
      riskLevel: "CRITICAL",
      aiRecommendation: {
        action: "APPROVE",
        confidence: 87,
        reasoning: "Contact engagement high, budget aligned, past similar 73% win",
        signals: [
          { type: "POSITIVE", weight: 95, description: "Budget fit" },
          { type: "POSITIVE", weight: 85, description: "Engagement high" },
          { type: "UNKNOWN", weight: 50, description: "Competitive landscape" }
        ],
        pastSimilar: { count: 3, approvalRate: 0.73 }
      }
    }
  ],
  routine: [...]
}

// ENDPOINT 2: POST /approvals/{id}/feedback
// Store user decision vs AI recommendation for model learning
```

### Tasks

- [ ] **Backend**: Add `risk_level` + `ai_recommendation` JSON to `ApprovalRequest` entity
- [ ] **Backend**: Create `GET /approvals/stratified` with above schema
- [ ] **Frontend**: Create `ApprovalCard.tsx` component (visual + interactions)
- [ ] **Frontend**: Create `ApprovalHub.tsx` page combining all approvals
- [ ] **Frontend**: Add `src/app/service-desk/approvals-hub/page.tsx`
- [ ] **Testing**: Unit tests for ApprovalCard, integration test for hub flow
- [ ] **Deploy**: Feature flag `APPROVALS_V2=true` on 10% canary

### Expected Outcome
Users see critical approvals first. Approval time: 5 min → 1-2 min. Confidence in AI: 65% → 80%.

---

## 📊 PHASE 2: IMPACT TIMELINE (Week 2-3)

### What to Build

```
src/components/timeline/
├── TimelineEvent.tsx        ← Single event card (title, impact, actions)
├── ImpactTimeline.tsx       ← Scrollable timeline sorted by impact
└── TimelineFilter.tsx       ← Filter: Urgent | My Action | All

src/app/command-center/
└── page.tsx                 ← REFACTOR: Replace KPI grid with timeline
```

### Backend Requirements

```typescript
// ENDPOINT: GET /command-center/timeline?sort=impact&filter=urgent
{
  events: [
    {
      id: "evt-123",
      type: "APPROVAL_NEEDED",
      impact: "CRITICAL",
      title: "Acme Corp $24K proposal ready",
      description: "Sales agent scored 87/100",
      timestamp: "2026-07-02T12:00:00Z",
      actions: [
        { label: "Review Proposal", url: "/approvals/..." },
        { label: "Escalate", action: "escalate" }
      ],
      metadata: {
        amount: 24000,
        agent: { name: "Sales Agent" },
        department: { name: "Sales" }
      }
    },
    // More events sorted by impact...
  ],
  summary: {
    urgentCount: 3,
    myActionCount: 5,
    totalToday: 24
  }
}
```

### Tasks

- [ ] **Backend**: Create `/command-center/timeline` endpoint
- [ ] **Frontend**: Create `TimelineEvent.tsx`
- [ ] **Frontend**: Create `ImpactTimeline.tsx`
- [ ] **Frontend**: Refactor `command-center/page.tsx` to use timeline
- [ ] **Testing**: E2E test: Navigate to command-center, verify timeline loads
- [ ] **Deploy**: Feature flag `DASHBOARD_V2=true`

### Expected Outcome
Dashboard is now intelligence-driven. Users see what matters. Better prioritization.

---

## 🔗 PHASE 3: CROSS-DEPT CONTEXT (Week 3-4)

### What to Build

```
src/components/context/
├── ContextCard.tsx          ← Shows initiative spanning multiple depts
├── DependencyGraph.tsx      ← Upstream blockers + downstream waiters
└── ContextThread.tsx        ← Full context + related work

src/app/departments/[id]/workspace/
└── page.tsx                 ← ADD: ContextCard section + dependencies
```

### Backend Requirements

```typescript
// ENDPOINT: GET /departments/{id}/context
{
  initiatives: [
    {
      id: "init-atlas-v2",
      title: "Atlas v2 Launch",
      status: "ON_TRACK",
      progressScore: 87,
      departmentStats: [
        { dept: "Sales", stat: "Qualified leads", value: "23" },
        { dept: "Marketing", stat: "Posts queued", value: "12" },
        { dept: "Support", stat: "Pre-sale Q&A", value: "2" },
        { dept: "Ops", stat: "Blockers", value: "1" },
        { dept: "Finance", stat: "Budget left", value: "$45K" }
      ]
    }
  ],
  dependencies: {
    upstreamBlockers: [
      "Ops: AWS invoice reconciliation (2h)"
    ],
    downstreamWaiters: [
      "Support: Waiting on docs from Engineering"
    ]
  }
}
```

### Tasks

- [ ] **Backend**: Add `context_initiative` table linking cross-dept work
- [ ] **Backend**: Create `GET /departments/{id}/context` endpoint
- [ ] **Frontend**: Create `ContextCard.tsx`
- [ ] **Frontend**: Add context section to department workspace pages
- [ ] **Testing**: Verify context cards show up on department page
- [ ] **Deploy**: Feature flag `CROSS_DEPT_CONTEXT=true`

### Expected Outcome
Departments see their role in larger initiatives. Context-switching reduced 40%.

---

## 🤖 PHASE 4: AGENT ORCHESTRATION (Week 4-5)

### What to Build

```
src/components/agents/
├── AgentOrchestrationBoard.tsx  ← Grid of agent status cards
├── AgentCard.tsx                ← Individual agent: name, dept, current task, progress
└── AgentStatusWidget.tsx        ← TopBar widget: "14/16 agents online"

src/components/layout/
└── TopBar.tsx                   ← ADD: Agent status widget

src/app/agents/orchestration/
└── page.tsx                     ← Full orchestration board
```

### Backend Requirements

```typescript
// ENDPOINT: GET /agents/orchestration
// Real-time: WebSocket /ws/agents/status
{
  agents: [
    {
      id: "agent-sales-lead",
      name: "Sales Lead Agent",
      department: { id: "...", name: "Sales" },
      status: "ACTIVE",
      currentTask: {
        title: "Qualifying 3 new leads",
        progress: 45,
        eta: 480, // seconds
        reasoning: "Checking budget + fit against ICP criteria"
      },
      queue: 2,
      performance: {
        completedToday: 12,
        accuracy: 92,
        avgCompletionTime: 240
      }
    },
    // More agents...
  ],
  summary: {
    totalOnline: 14,
    totalOffline: 2,
    activelyWorking: 6,
    idle: 5,
    standby: 3
  }
}
```

### Tasks

- [ ] **Backend**: Expose agent status via `/agents/orchestration`
- [ ] **Backend**: Implement WebSocket `/ws/agents/status` for real-time updates
- [ ] **Frontend**: Create `AgentOrchestrationBoard.tsx`
- [ ] **Frontend**: Create `AgentStatusWidget.tsx` for TopBar
- [ ] **Frontend**: Add `/agents/orchestration` page
- [ ] **Frontend**: Update `IconRail` to link to orchestration
- [ ] **Testing**: Connect to real agent WebSocket, verify updates
- [ ] **Deploy**: Feature flag `AGENT_ORCHESTRATION=true`

### Expected Outcome
Users know what agents are doing in real-time. Trust & transparency ↑.

---

## 📋 PHASE 5: BATCH APPROVALS & LEARNING (Week 5-6)

### What to Build

```
src/components/approvals/
├── BatchApprovalUI.tsx      ← Checkbox list + batch action buttons
├── FeedbackModal.tsx        ← "Why did you reject AI's recommendation?"
└── LearningChart.tsx        ← Show AI accuracy over time

src/stores/
└── approvalStore.ts         ← ADD: Batch selection state + feedback
```

### Backend Requirements

```typescript
// ENDPOINT 1: POST /approvals/batch-approve
{
  approvalIds: ["...", "...", "..."],
  action: "APPROVE"
}

// ENDPOINT 2: POST /approvals/{id}/feedback
{
  userDecision: "REJECTED",
  aiRecommendation: "APPROVED",
  reason: "wrong_fit" | "bad_timing" | "quality_issue" | "other",
  explanation?: string
}
// → Backend stores + retrains confidence model

// ENDPOINT 3: GET /approvals/accuracy-trends
{
  trends: [
    { date: "2026-07-01", aiAccuracy: 0.82, userCorrections: 3 },
    { date: "2026-07-02", aiAccuracy: 0.84, userCorrections: 2 }
  ]
}
```

### Tasks

- [ ] **Frontend**: Add checkboxes to routine approvals in ApprovalHub
- [ ] **Frontend**: Build batch approve button + confirmation
- [ ] **Backend**: Create `POST /approvals/batch-approve` endpoint
- [ ] **Frontend**: Build `FeedbackModal.tsx`
- [ ] **Backend**: Create `POST /approvals/{id}/feedback` endpoint
- [ ] **Backend**: Implement feedback loop → model retraining (async)
- [ ] **Frontend**: Add learning chart to show AI accuracy trends
- [ ] **Testing**: Batch approve 10 items in 1 click; verify feedback stored
- [ ] **Deploy**: Feature flag `BATCH_APPROVALS=true`

### Expected Outcome
Routine approvals: 10 clicks → 1 click. AI accuracy improves 2% per week.

---

## 🎯 IMPLEMENTATION CHECKLIST

### Week 1
- [ ] Backend: Approval risk + confidence schema
- [ ] Backend: `/approvals/stratified` endpoint
- [ ] Frontend: `ApprovalCard.tsx` + `ApprovalHub.tsx`
- [ ] Test: Approval flow e2e
- [ ] Deploy: APPROVALS_V2 canary

### Week 2
- [ ] Backend: `/command-center/timeline` endpoint  
- [ ] Frontend: `TimelineEvent.tsx` + `ImpactTimeline.tsx`
- [ ] Frontend: Refactor command-center page
- [ ] Test: Timeline rendering + sorting
- [ ] Deploy: DASHBOARD_V2 canary

### Week 3
- [ ] Backend: Context initiative endpoints
- [ ] Frontend: `ContextCard.tsx` + `DependencyGraph.tsx`
- [ ] Frontend: Add to department pages
- [ ] Test: Context display on dept page
- [ ] Deploy: CROSS_DEPT_CONTEXT canary

### Week 4
- [ ] Backend: Agent orchestration endpoints + WebSocket
- [ ] Frontend: `AgentOrchestrationBoard.tsx`
- [ ] Frontend: TopBar widget
- [ ] Test: Real-time agent updates
- [ ] Deploy: AGENT_ORCHESTRATION canary

### Week 5-6
- [ ] Frontend: Batch approval UI
- [ ] Backend: Batch approve endpoint
- [ ] Frontend: Feedback modal
- [ ] Backend: Feedback loop + retraining
- [ ] Test: End-to-end approval + learning flow
- [ ] Deploy: BATCH_APPROVALS + LEARNING_LOOP to 100%

---

## 🚀 SUCCESS METRICS

Track these before/after each release:

```typescript
interface MetricsToTrack {
  // Approval Metrics
  avgApprovalTime: number;           // Target: 5m → 1-2m
  batchApprovalRate: number;         // Target: >40%
  approvalAccuracy: number;          // Won/lost deal correlation
  userConfidenceInAI: number;        // 1-5 scale, target 4.2
  rejectionRate: number;             // <10% for high-confidence
  
  // Engagement Metrics
  featureAdoption: number;           // % users, target >80% w2
  commandPaletteUsage: number;       // % of navigation
  commandCenterVisits: number;       // Daily active users
  
  // Performance Metrics
  pageLoadTime: number;              // Milliseconds
  webSocketLatency: number;          // Real-time lag
  errorRate: number;                 // <0.1%
  
  // Learning Metrics
  feedbackSubmissionRate: number;    // % rejections with feedback
  aiAccuracyTrendingUp: boolean;     // Should improve >1% per week
  mostRatedReasons: string[];        // Top reasons for rejection
}
```

---

## 📚 KEY FILES REFERENCE

| File | Purpose | Status |
|------|---------|--------|
| `components/command-palette/CommandPalette.tsx` | Cmd+K navigation | ✓ |
| `app/command-center/page.tsx` | Landing/dashboard | ⚠️ (needs timeline) |
| `app/service-desk/page.tsx` | Unified service hub | ✓ |
| `components/layout/TopBar.tsx` | Global header | ⚠️ (needs agent widget) |
| `components/layout/IconRail.tsx` | Collapsed sidebar | ✓ |
| `stores/*.ts` | State management | ✓ |
| `services/api.ts` | HTTP client | ✓ |
| `services/socket.ts` | WebSocket client | ✓ |

---

## 🤝 DEVELOPER HANDOFF

**For Backend Team:**
- Enhance approval entity with risk + AI recommendation data
- Create 5 new endpoints (see ENDPOINTS section above)
- Implement approval scoring + feedback retraining service
- Add WebSocket support for agent orchestration

**For Frontend Team:**
- Build 10+ new React components (see COMPONENTS section)
- Implement real-time data fetching + WebSocket listeners
- Add feature flags for progressive rollout
- Create e2e tests for critical flows

**For QA Team:**
- Test approval workflows end-to-end
- Verify real-time updates work correctly
- Performance testing with 100+ approvals
- User acceptance testing with finance/ops teams

---

**Total Timeline**: 6 weeks to full implementation  
**Quick Win**: Risk-stratified approvals in Week 1  
**Business Impact**: 40-60 min saved per power user per week
