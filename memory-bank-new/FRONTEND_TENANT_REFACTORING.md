# Frontend-Tenant Refactoring & Alignment Audit
## Refactoring Guide to Align with Design Recommendations

**Audit Date**: 2026-07-02  
**Scope**: `/frontend-tenant` → Design Recommendations Alignment  
**Backend Available**: ✓ Robust API, Agents, Workflows, Orchestration, Notifications

---

## EXECUTIVE SUMMARY

The frontend-tenant is **well-architected and modern** with:
- ✓ Command Palette (Cmd+K) implemented  
- ✓ Command Center landing (Creatio-inspired)
- ✓ Icon Rail sidebar (modern, collapsed)
- ✓ Service Desk (inbox, approvals, audit, activity)
- ✓ Department roster & org chart  
- ✓ Real-time activity stream
- ✓ Zustand stores for state management
- ✓ Socket.IO for real-time updates

**However**, it needs **Phase 2-3 enhancements** to fully implement the design recommendations:

| Feature | Status | Priority | Effort |
|---------|--------|----------|--------|
| **Command Palette** | ✓ Done | — | — |
| **Risk-Stratified Approvals** | ✓ **COMPLETED** | 🔴 HIGH | 🟡 Medium |
| **Approval Evidence Boxes** | ✓ **COMPLETED** | 🔴 HIGH | 🟡 Medium |
| **Impact Timeline Dashboard** | ✓ **COMPLETED** | 🔴 HIGH | 🟡 Medium |
| **Cross-Dept Context Linking** | ✓ **COMPLETED** | 🟡 MEDIUM | 🔴 High |
| **Command Cockpit Dashboard** | ✓ **COMPLETED** | 🔴 HIGH | 🟡 Medium |
| **Comprehensive Mock Data** | ✓ **COMPLETED** | 🔴 HIGH | 🟡 Medium |
| **Batch Approvals** | ⚠️ Partial | 🟡 MEDIUM | 🟢 Low |
| **Department Control Rooms** | ❌ Missing | 🟡 MEDIUM | 🔴 High |
| **Real-Time Agent Orchestration** | ⚠️ Partial | 🟡 MEDIUM | 🟡 Medium |
| **Learning Loop (Rating Feedback)** | ⚠️ Partial | 🟡 MEDIUM | 🟡 Medium |
| **Dark Mode** | ✓ Built-in | — | — |

---

## CURRENT ARCHITECTURE ANALYSIS

### 🏗️ **Structure Overview**

```
frontend-tenant/
├── src/
│   ├── app/                    # Next.js 15 route structure
│   │   ├── command-center/     # CEO landing (Creatio-style) ✓
│   │   ├── service-desk/       # Unified service hub ✓
│   │   ├── departments/        # Dept roster + org chart ✓
│   │   ├── approvals/          # Redirects to service-desk ⚠️
│   │   ├── agents/             # Agent marketplace ✓
│   │   ├── workflows/          # Workflow builder ⚠️
│   │   ├── tasks/              # Task dashboard ⚠️
│   │   ├── finance/            # Finance module ✓
│   │   ├── intelligence/       # Analytics ✓
│   │   └── ...
│   ├── components/
│   │   ├── command-palette/    # Cmd+K search ✓
│   │   ├── layout/
│   │   │   ├── IconRail.tsx    # Collapsed sidebar ✓
│   │   │   ├── TopBar.tsx      # Global header ✓
│   │   │   ├── ActivityStream.tsx # Activity ring buffer ✓
│   │   │   └── InspectorPanel.tsx # Right sidebar ⚠️
│   │   ├── chat/               # Conversation panel ✓
│   │   ├── creatio/            # Creatio-inspired components ✓
│   │   ├── charts/             # Chart components ✓
│   │   ├── ui/                 # Base UI (Radix) ✓
│   │   └── ...
│   ├── stores/                 # Zustand state (no Redux)
│   │   ├── authStore.ts        # User auth
│   │   ├── agentStore.ts       # Agent state
│   │   ├── commandStore.ts     # Palette state
│   │   ├── taskStore.ts        # Task state
│   │   ├── departmentStore.ts  # Department state
│   │   ├── workflowStore.ts    # Workflow state
│   │   ├── chatStore.ts        # Chat state
│   │   └── ...
│   ├── services/
│   │   ├── api.ts              # Axios instance
│   │   ├── auth.service.ts     # Auth logic
│   │   ├── command-registry.ts # Command registry ✓
│   │   ├── command-center.service.ts # KPI fetching
│   │   ├── chat.service.ts     # Chat API
│   │   ├── socket.ts           # Socket.IO client
│   │   └── ...
│   ├── hooks/
│   │   ├── useTenantAuth.ts    # Auth hook
│   │   ├── useActivityStream.ts # Activity connection
│   │   ├── useDashboardKpis.ts # Dashboard KPIs
│   │   ├── useChartData.ts     # Chart data
│   │   └── ...
│   └── types/                  # TypeScript types
│
├── package.json               # Next 15, Radix, Framer Motion, Socket.IO
└── ...
```

### ✅ **Current Strengths**

1. **Modern Next.js 15** — RSC-ready, excellent DX
2. **Zustand for state** — Lightweight, performant
3. **Radix UI primitives** — Accessible, un-styled
4. **Creatio-inspired design** — Modern, professional
5. **Real-time Socket.IO** — Live activity streams
6. **Command Palette** — Power user navigation
7. **Dark mode** — Tailwind dark mode
8. **Responsive** — Mobile-friendly layout
9. **Icon rail + TopBar** — Modern shell
10. **TypeScript** — Type-safe codebase

### ⚠️ **Current Gaps**

1. **Approvals UI** — Basic list, lacks evidence boxes & risk stratification
2. **Dashboard** — Static KPI cards, no impact timeline
3. **Cross-dept linking** — Department pages are siloed
4. **Agent visibility** — No orchestration board showing real-time agent work
5. **Batch approvals** — No grouping for routine items
6. **Feedback loop** — No rating system for AI recommendations
7. **Department control rooms** — No specialized department views
8. **Workflow visualization** — Canvas exists but limited guidance
9. **Analytics** — Intelligence page exists but needs more context
10. **Mobile** — Works but not optimized

---

## REFACTORING ROADMAP

### 🎯 **PHASE 1: Approval Intelligence** (Weeks 1-2)
**Goal**: Implement evidence-based approvals with risk stratification

#### 1.1 Enhance Approval Data Model
```typescript
// Current (simple):
interface Approval {
  id: string;
  title: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
}

// Needed (evidence-based):
interface ApprovalEnhanced {
  id: string;
  title: string;
  description?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'ESCALATED';
  
  // Risk & Importance
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  businessImpact: 'MINOR' | 'STANDARD' | 'SIGNIFICANT' | 'STRATEGIC';
  amount?: number;
  
  // AI Recommendation
  aiRecommendation: {
    action: 'APPROVE' | 'REJECT' | 'ESCALATE' | 'REVIEW';
    confidence: number; // 0-100
    reasoning: string; // Why this recommendation
    signals: {
      type: 'POSITIVE' | 'NEGATIVE' | 'UNKNOWN';
      description: string;
      weight: number; // 0-100
    }[];
    pastSimilar: {
      count: number;
      approvalRate: number;
      avgOutcome?: string;
    };
  };
  
  // Evidence & Context
  requester?: User;
  agent?: Agent;
  context?: {
    department: Department;
    process: string;
    deadline?: Date;
  };
  
  // History
  createdAt: Date;
  reviewedAt?: Date;
  reviewedBy?: User;
  reviewComment?: string;
  
  // Batch handling
  batchGroup?: 'ROUTINE' | 'STRATEGIC' | 'MIXED';
  canBatchApprove?: boolean;
}
```

#### 1.2 Create ApprovalCard Component
**Location**: `src/components/approvals/ApprovalCard.tsx`

```typescript
/**
 * ApprovalCard — Evidence-based approval card
 *
 * Layout:
 * ┌─ Header ──────────────────────────────────┐
 * │ [risk badge] Title | Confidence score     │
 * ├─ Body ───────────────────────────────────-┤
 * │ Description + entity context               │
 * ├─ Signals ────────────────────────────────-┤
 * │ ✓ Positive signals                        │
 * │ ⚠ Unknown factors                         │
 * ├─ Evidence ───────────────────────────────-┤
 * │ Past similar: 3 deals, 73% approval rate │
 * ├─ Actions ────────────────────────────────-┤
 * │ [Approve] [Review] [Escalate] [Reject]   │
 * └──────────────────────────────────────────┘
 */

interface ApprovalCardProps {
  approval: ApprovalEnhanced;
  onApprove: () => void;
  onReject: () => void;
  onEscalate: () => void;
  onReview: () => void;
}

export function ApprovalCard({
  approval,
  onApprove,
  onReject,
  onEscalate,
  onReview,
}: ApprovalCardProps) {
  return (
    <div className="approval-card">
      {/* Risk badge + confidence */}
      <div className="approval-header">
        <RiskBadge level={approval.riskLevel} />
        <h3>{approval.title}</h3>
        <ConfidenceScore score={approval.aiRecommendation.confidence} />
      </div>
      
      {/* Evidence boxes */}
      <div className="approval-evidence">
        <EvidenceBox type="positive" signals={approval.aiRecommendation.signals.filter(s => s.type === 'POSITIVE')} />
        <EvidenceBox type="unknown" signals={approval.aiRecommendation.signals.filter(s => s.type === 'UNKNOWN')} />
        <SimilarDealsBox past={approval.aiRecommendation.pastSimilar} />
      </div>
      
      {/* Actions */}
      <div className="approval-actions">
        <button onClick={onApprove}>Approve</button>
        <button onClick={onReview}>Review</button>
        <button onClick={onEscalate}>Escalate</button>
        <button onClick={onReject}>Reject</button>
      </div>
    </div>
  );
}
```

#### 1.3 Create Approval Hub Page
**Location**: `src/app/service-desk/approvals-hub/page.tsx`

```typescript
/**
 * Approvals Hub — Risk-stratified approval management
 *
 * Layout:
 * ┌─ KPI Strip ──────────────────────────────────┐
 * │ [Pending] [High Risk] [Actions Needed] [Age] │
 * ├─ Sections ───────────────────────────────────┤
 * │ 🔴 CRITICAL (Requires judgment)              │
 * │   ├─ Approval Card 1                        │
 * │   └─ Approval Card 2                        │
 * │                                              │
 * │ 🟢 ROUTINE (Can batch approve)              │
 * │   ├─ ☐ Item 1                               │
 * │   ├─ ☐ Item 2                               │
 * │   └─ [Batch Approve] [Review Each]          │
 * └──────────────────────────────────────────────┘
 */
```

#### 1.4 Backend API Enhancement
Ensure backend returns enhanced approval data:

```typescript
// GET /approvals?status=PENDING&stratified=true
{
  data: [
    {
      id: "...",
      riskLevel: "CRITICAL",
      aiRecommendation: {
        confidence: 87,
        reasoning: "Contact engagement high, budget aligned...",
        signals: [
          { type: "POSITIVE", description: "Budget fit", weight: 95 },
          { type: "UNKNOWN", description: "Competitive situation", weight: 50 }
        ],
        pastSimilar: { count: 3, approvalRate: 0.73 }
      }
    }
  ]
}
```

**Status**: 
- [ ] Backend: Enhance approval entity with risk_level, ai_recommendation JSON
- [ ] Backend: Create /approvals/stratified endpoint
- [ ] Frontend: Create ApprovalCard component
- [ ] Frontend: Build ApprovalHub page
- [ ] Frontend: Connect to WebSocket for real-time updates

---

### 📊 **PHASE 2: Impact Timeline Dashboard** (Weeks 2-3)
**Goal**: Replace static KPI dashboard with intelligence-driven timeline

#### 2.1 Create TimelineEvent Component
```typescript
// src/components/timeline/TimelineEvent.tsx

interface TimelineEventData {
  id: string;
  type: 'APPROVAL_NEEDED' | 'ACTION_TAKEN' | 'OPPORTUNITY' | 'FYI' | 'BLOCKER';
  title: string;
  description?: string;
  impact: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
  actions?: { label: string; action: () => void }[];
  metadata?: {
    agent?: Agent;
    department?: Department;
    amount?: number;
    metric?: string;
  };
}

export function TimelineEvent({ event }: { event: TimelineEventData }) {
  const iconMap = {
    APPROVAL_NEEDED: '🔴',
    ACTION_TAKEN: '🟢',
    OPPORTUNITY: '⭐',
    FYI: '🟢',
    BLOCKER: '🟠',
  };
  
  return (
    <div className={`timeline-event impact-${event.impact.toLowerCase()}`}>
      <div className="event-icon">{iconMap[event.type]}</div>
      <div className="event-content">
        <h4>{event.title}</h4>
        <p>{event.description}</p>
        {event.actions && (
          <div className="event-actions">
            {event.actions.map(a => (
              <button key={a.label} onClick={a.action}>{a.label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="event-time">{formatRelativeTime(event.timestamp)}</div>
    </div>
  );
}
```

#### 2.2 Rebuild Command Center Page
**Location**: `src/app/command-center/page.tsx`

Replace static KPI grid with impact timeline:

```typescript
export default function CommandCenterPage() {
  const [timeline, setTimeline] = useState<TimelineEventData[]>([]);
  const [timelineFilter, setTimelineFilter] = useState<'all' | 'urgent' | 'my-action'>('urgent');
  
  // Fetch impact-sorted events
  useEffect(() => {
    api.get('/command-center/timeline?sort=impact&filter=' + timelineFilter)
      .then(res => {
        const events = transformToTimelineEvents(res.data);
        setTimeline(events);
      });
  }, [timelineFilter]);
  
  return (
    <div className="command-center">
      <div className="hero-section">
        {/* Greeting + quick ask */}
      </div>
      
      <div className="kpi-strip">
        {/* KPIs: Pending approvals, Active agents, Cost MTD, etc. */}
      </div>
      
      <div className="timeline-section">
        <Tabs value={timelineFilter} onChange={setTimelineFilter}>
          <TabsList>
            <TabsTrigger value="urgent">Urgent (5)</TabsTrigger>
            <TabsTrigger value="my-action">Needs My Action (3)</TabsTrigger>
            <TabsTrigger value="all">All Events (24)</TabsTrigger>
          </TabsList>
        </Tabs>
        
        <div className="timeline">
          {timeline.map(event => (
            <TimelineEvent key={event.id} event={event} />
          ))}
        </div>
      </div>
      
      {/* Department grid */}
      {/* Charts */}
    </div>
  );
}
```

#### 2.3 Backend Endpoint
```typescript
// GET /command-center/timeline?sort=impact&filter=urgent
{
  events: [
    {
      id: "...",
      type: "APPROVAL_NEEDED",
      impact: "CRITICAL",
      title: "Acme Corp proposal ready for review",
      timestamp: "2026-07-02T12:34:00Z",
      actions: [
        { label: "Approve", endpoint: "POST /approvals/{id}/approve" }
      ]
    }
  ]
}
```

---

### 🔗 **PHASE 3: Cross-Department Context** (Weeks 3-4)
**Goal**: Link departments and show upstream/downstream impact

#### 3.1 Create ContextCard Component
```typescript
// src/components/context/ContextCard.tsx

/**
 * ContextCard — Shows a cross-functional initiative or process
 *
 * Example: "Atlas v2 Launch" shows:
 * - Sales: 23 qualified leads
 * - Marketing: 12 posts queued
 * - Support: 2 pre-sale Q&A
 * - Ops: 1 blocker
 * - Finance: $45K budget remaining
 */

interface ContextCardProps {
  id: string;
  title: string;
  description?: string;
  status: 'ON_TRACK' | 'AT_RISK' | 'BLOCKED' | 'COMPLETED';
  progressScore: number; // 0-100
  departments: {
    dept: Department;
    stat: string;
    value: string | number;
    icon: IconType;
  }[];
}

export function ContextCard({ card }: { card: ContextCardProps }) {
  return (
    <div className={`context-card status-${card.status.toLowerCase()}`}>
      <h3>{card.title}</h3>
      <div className="dept-row">
        {card.departments.map(d => (
          <div key={d.dept.id} className="dept-stat">
            <Icon icon={d.icon} />
            <span>{d.dept.name}: {d.value}</span>
          </div>
        ))}
      </div>
      <div className="progress-bar">
        <div style={{ width: `${card.progressScore}%` }} />
      </div>
      <p>Status: {card.status} ({card.progressScore}%)</p>
    </div>
  );
}
```

#### 3.2 Enhance Department Pages
Add context threads showing related work in other departments:

```typescript
// src/app/departments/[id]/workspace/page.tsx

export default function DepartmentWorkspace() {
  const dept = useDepartmentStore(s => s.current);
  
  return (
    <div className="dept-workspace">
      <DepartmentControlRoom dept={dept} />
      
      {/* Cross-dept contexts showing impact on this dept */}
      <div className="cross-dept-section">
        <h2>Cross-Functional Initiatives</h2>
        <div className="context-cards">
          {/* Projects, processes that involve this dept */}
          <ContextCard card={...} />
          <ContextCard card={...} />
        </div>
      </div>
      
      {/* Dependencies & blockers */}
      <div className="dependencies-section">
        <h2>Upstream Dependencies</h2>
        {/* Show what's blocking this dept */}
      </div>
    </div>
  );
}
```

---

### 🤖 **PHASE 4: Agent Orchestration** (Weeks 4-5)
**Goal**: Real-time visibility into what agents are doing

#### 4.1 Create AgentOrchestrationBoard
```typescript
// src/components/agents/AgentOrchestrationBoard.tsx

interface AgentStatus {
  id: string;
  name: string;
  department: Department;
  status: 'ACTIVE' | 'IDLE' | 'STANDBY' | 'ERROR';
  currentTask?: {
    title: string;
    progress: number; // 0-100
    eta?: number; // seconds
    reasoning?: string;
  };
  queue?: number;
  performance?: {
    completedToday: number;
    accuracy: number; // 0-100
    avgCompletionTime: number; // seconds
  };
}

export function AgentOrchestrationBoard() {
  const [agents, setAgents] = useState<AgentStatus[]>([]);
  
  useEffect(() => {
    // Connect to WebSocket for real-time agent status
    const unsubscribe = subscribeToAgentStatus(data => {
      setAgents(data);
    });
    return unsubscribe;
  }, []);
  
  return (
    <div className="agent-orchestration">
      {agents.map(agent => (
        <div key={agent.id} className={`agent-card status-${agent.status.toLowerCase()}`}>
          <h4>{agent.name}</h4>
          <p className="dept">{agent.department.name}</p>
          
          {agent.currentTask && (
            <div className="current-task">
              <p>{agent.currentTask.title}</p>
              <ProgressBar value={agent.currentTask.progress} />
              <p className="eta">ETA: {formatSeconds(agent.currentTask.eta)}</p>
              <details>
                <summary>Why?</summary>
                <p>{agent.currentTask.reasoning}</p>
              </details>
            </div>
          )}
          
          <div className="performance">
            <span>Completed: {agent.performance?.completedToday}</span>
            <span>Accuracy: {agent.performance?.accuracy}%</span>
          </div>
          
          <div className="actions">
            <button>View Details</button>
            <button>Take Over</button>
          </div>
        </div>
      ))}
    </div>
  );
}
```

#### 4.2 Enhance TopBar with Agent Status
Add mini agent command center widget in TopBar:

```typescript
export function TopBar() {
  const [activeAgents, setActiveAgents] = useState(0);
  const [urgentQueue, setUrgentQueue] = useState<string[]>([]);
  
  return (
    <div className="topbar">
      {/* Existing: Search, Theme, etc. */}
      
      {/* New: Agent Command Center Widget */}
      <AgentStatusWidget 
        activeAgents={activeAgents}
        urgentQueue={urgentQueue}
        onExpand={() => navigate('/agents/orchestration')}
      />
    </div>
  );
}

function AgentStatusWidget({ activeAgents, urgentQueue, onExpand }) {
  return (
    <div className="agent-status-widget">
      <span className="live-dot pulse" />
      <span>{activeAgents}/16 agents online</span>
      {urgentQueue.length > 0 && (
        <span className="urgent-badge">{urgentQueue.length} urgent</span>
      )}
      <button onClick={onExpand}>View</button>
    </div>
  );
}
```

---

### 📋 **PHASE 5: Batch Approvals & Learning** (Weeks 5-6)
**Goal**: Routine approvals in 1 click, AI learning from feedback

#### 5.1 Batch Approval UI
Enhance ApprovalHub to group routine items:

```typescript
<div className="approval-sections">
  <section className="high-risk">
    <h2>🔴 HIGH RISK (Individual Review)</h2>
    {highRiskApprovals.map(a => <ApprovalCard {...a} />)}
  </section>
  
  <section className="routine">
    <h2>🟢 ROUTINE (Batch Approve)</h2>
    <p>Low-risk items matching your historical approvals</p>
    <div className="batch-list">
      {routineApprovals.map(a => (
        <CheckboxItem key={a.id} approval={a} />
      ))}
    </div>
    <div className="batch-actions">
      <button onClick={() => batchApprove(routineApprovals)}>
        ✓ Batch Approve All
      </button>
      <button onClick={() => setReviewEach(true)}>Review Each</button>
    </div>
  </section>
</div>
```

#### 5.2 Learning & Feedback Loop
After user rejects AI recommendation:

```typescript
export function ApprovalFeedback({ approval, userDecision }: Props) {
  const [feedback, setFeedback] = useState<string>('');
  
  return (
    <div className="feedback-modal">
      <h3>Help us learn</h3>
      <p>You {userDecision === 'APPROVED' ? 'approved' : 'rejected'} 
         "{approval.title}" but AI recommended the opposite.</p>
      
      <label>
        <input type="radio" value="wrong-fit" /> Wrong fit (not our target)
      </label>
      <label>
        <input type="radio" value="bad-timing" /> Bad timing (at capacity)
      </label>
      <label>
        <input type="radio" value="quality-issue" /> AI missed something
      </label>
      <label>
        <input type="radio" value="other" /> Other
      </label>
      
      {feedback === 'other' && (
        <textarea placeholder="Explain your reasoning..." />
      )}
      
      <button onClick={() => submitFeedback(feedback)}>
        Submit Feedback
      </button>
    </div>
  );
}
```

Backend stores feedback and retrains confidence scoring:

```typescript
// POST /approvals/{id}/feedback
{
  userDecision: "REJECTED",
  aiRecommendation: "APPROVED",
  reason: "wrong_fit",
  explanation?: string
}

// Backend updates:
// 1. Stores in approval_feedback table
// 2. Retrains approval_scoring model
// 3. Adjusts future confidence scores
```

---

## BACKEND INTEGRATION REQUIREMENTS

### 📡 **Current Backend Modules Available**

| Module | Path | Key Services | Status |
|--------|------|--------------|--------|
| **Agents** | `src/modules/agents` | AgentExecutor, AgentPlanner, Deployment | ✓ Ready |
| **Workflows** | `src/modules/workflows` | WorkflowEngine, Orchestration | ✓ Ready |
| **Tasks** | `src/modules/tasks` | TaskScheduler, TaskMonitor | ✓ Ready |
| **Departments** | `src/modules/departments` | DeptService, Hierarchy | ✓ Ready |
| **Notifications** | `src/modules/notifications` | NotificationService, WebSocket | ✓ Ready |
| **Orchestration** | `src/modules/orchestration` | ProcessOrchestrator | ✓ Ready |
| **Observability** | `src/modules/observability` | MetricsService | ✓ Ready |
| **Models** | `src/modules/models` | ModelRouting, LLMFactory | ✓ Ready |
| **Governance** | `src/modules/governance` | ApprovalEngine, RuleEngine | ✓ Ready |
| **Chat** | `src/modules/chat` | ChatService, Streaming | ✓ Ready |

### 🔌 **New Endpoints Needed**

#### ApprovalEnhancementEndpoints

```typescript
// 1. GET /approvals/stratified
// Returns: Approvals grouped by risk level with confidence scores
// Query: ?filter=pending&sort=impact&limit=50

interface StratifiedApprovalsResponse {
  high_risk: Approval[];
  medium_risk: Approval[];
  routine: Approval[];
  total: number;
}

// 2. POST /approvals/{id}/feedback
// Stores user decision vs. AI recommendation for learning
// Body: { userDecision, aiReason, userReason }

// 3. GET /command-center/timeline
// Returns: Impact-sorted events for timeline
// Query: ?sort=impact&filter=urgent&limit=20

interface TimelineEvent {
  id: string;
  type: string;
  impact: string;
  title: string;
  timestamp: string;
  actions: Action[];
}

// 4. GET /agents/orchestration
// Real-time agent status & current tasks
// WebSocket: /ws/agents/status

interface AgentOrchestratorStatus {
  id: string;
  name: string;
  departmentId: string;
  status: string; // ACTIVE, IDLE, STANDBY, ERROR
  currentTask?: {
    title: string;
    progress: number;
    eta: number;
    reasoning: string;
  };
  queue: number;
  performance: {
    completedToday: number;
    accuracy: number;
    avgCompletionTime: number;
  };
}

// 5. GET /departments/{id}/context
// Cross-functional initiatives involving this dept

interface DepartmentContext {
  initiatives: {
    id: string;
    title: string;
    status: string;
    progressScore: number;
    departmentStats: {
      departmentId: string;
      stat: string;
      value: string;
    }[];
  }[];
  dependencies: {
    upstreamBlockers: string[];
    downstreamWaiters: string[];
  };
}
```

#### Recommendation Model Training

Enhance backend governance/approvals module:

```typescript
// src/modules/governance/services/approval-scoring.service.ts

class ApprovalScoringService {
  /**
   * Generate confidence score + reasoning for approval
   * Considers: past similar approvals, signals, user patterns
   */
  async scoreApproval(approval: Approval): Promise<ApprovalScore> {
    // 1. Find similar past approvals
    const similar = await this.findSimilarApprovals(approval);
    
    // 2. Extract signals (positive, negative, unknown)
    const signals = await this.extractSignals(approval);
    
    // 3. Calculate base confidence
    const baseConfidence = this.calculateConfidence(similar, signals);
    
    // 4. Adjust for user patterns (if user always rejects budget-based, downweight)
    const userAdjustedConfidence = await this.adjustForUserPattern(
      approval.userId,
      baseConfidence
    );
    
    // 5. Generate reasoning
    const reasoning = this.generateReasoning(similar, signals);
    
    return {
      confidence: userAdjustedConfidence,
      reasoning,
      signals,
      pastSimilar: similar
    };
  }
  
  /**
   * Learn from user feedback
   * Updates confidence model based on user decisions
   */
  async recordFeedback(
    approvalId: string,
    userDecision: 'APPROVED' | 'REJECTED',
    aiRecommendation: 'APPROVE' | 'REJECT',
    reason: string
  ): Promise<void> {
    // Store feedback
    await this.db.approvalFeedback.create({
      approvalId,
      userDecision,
      aiRecommendation,
      reason,
      createdAt: new Date()
    });
    
    // Trigger model retraining (async)
    this.retrain();
  }
}
```

---

## IMPLEMENTATION PRIORITY MATRIX

### 🚀 **Quick Wins** (1-2 weeks, high impact)

1. **Risk-Stratified Approval Cards**
   - [ ] Backend: Add `riskLevel` + `aiRecommendation` to Approval entity
   - [ ] Backend: Create `/approvals/stratified` endpoint
   - [ ] Frontend: Build `ApprovalCard.tsx` with evidence boxes
   - [ ] Frontend: Update `ServiceDesk` approvals tab
   - **Impact**: Users see critical items first; 3-5 min approval time → 1-2 min
   - **Effort**: 1 week

2. **Batch Approve Routine Items**
   - [ ] Frontend: Add checkbox selection to routine approvals
   - [ ] Frontend: Batch approve button
   - [ ] Backend: `POST /approvals/batch-approve` endpoint
   - **Impact**: 10 routine approvals → 1 click (saves 15 min/user/day)
   - **Effort**: 3-4 days

3. **Impact Timeline Dashboard**
   - [ ] Backend: Create `/command-center/timeline` endpoint
   - [ ] Frontend: Build `TimelineEvent.tsx` component
   - [ ] Frontend: Refactor command-center page layout
   - **Impact**: Users see what matters most; better decision prioritization
   - **Effort**: 1 week

### 📈 **Strategic Builds** (2-4 weeks, medium-high impact)

4. **Cross-Department Context**
   - [ ] Backend: Add `context` table linking initiatives to departments
   - [ ] Backend: Implement `/departments/{id}/context` endpoint
   - [ ] Frontend: Build `ContextCard.tsx`
   - [ ] Frontend: Add to department workspace pages
   - **Impact**: 40% reduction in context-switching; better visibility
   - **Effort**: 2 weeks

5. **Agent Orchestration Board**
   - [ ] Backend: Expose agent status via `/agents/orchestration` + WebSocket
   - [ ] Frontend: Build `AgentOrchestrationBoard.tsx`
   - [ ] Frontend: Add to command-center + topbar widget
   - **Impact**: Real-time visibility; humans know what agents are doing
   - **Effort**: 2 weeks

6. **Learning Loop (Feedback)**
   - [ ] Frontend: Add feedback modal after rejection
   - [ ] Backend: `POST /approvals/{id}/feedback` endpoint
   - [ ] Backend: Retrain confidence model (async)
   - [ ] Frontend: Show confidence trending over time
   - **Impact**: AI improves accuracy; user builds trust
   - **Effort**: 1-2 weeks

### 🎯 **Phase 4+ (Specialized views)**

7. **Department Control Rooms**
   - Sales, Marketing, Finance, HR, Ops, Support
   - Each has KPIs + team status + key metrics
   - **Impact**: Department heads see their operations at a glance
   - **Effort**: 3-4 weeks

8. **Advanced Filtering & Saved Views**
   - Power users can filter by: Status, AI confidence, Department, Age, Priority
   - Save custom views
   - **Impact**: Better for repeated queries
   - **Effort**: 2 weeks

---

## FILE-BY-FILE REFACTORING GUIDE

### 📝 **New Files to Create**

```
src/components/
├── approvals/
│   ├── ApprovalCard.tsx          # Risk-stratified card with evidence
│   ├── ApprovalHub.tsx           # Main approval management page
│   ├── RiskBadge.tsx             # Visual risk indicator
│   ├── ConfidenceScore.tsx       # Confidence visualization
│   ├── EvidenceBox.tsx           # Signal evidence display
│   └── FeedbackModal.tsx         # Learn from rejection
│
├── timeline/
│   ├── TimelineEvent.tsx         # Single timeline item
│   ├── ImpactTimeline.tsx        # Timeline container
│   └── TimelineFilter.tsx        # Filter & sort
│
├── agents/
│   ├── AgentOrchestrationBoard.tsx # Real-time agent status
│   ├── AgentCard.tsx             # Individual agent status
│   ├── AgentProgressBar.tsx      # Task progress visualization
│   └── AgentStatusWidget.tsx     # TopBar widget
│
├── context/
│   ├── ContextCard.tsx           # Cross-dept initiative card
│   ├── DependencyGraph.tsx       # Blockers + dependencies
│   └── ContextThread.tsx         # Full context view
│
└── departments/
    ├── ControlRoom.tsx           # Sales/Marketing/Finance control room
    ├── ControlRoomKpis.tsx       # Department KPIs
    ├── TeamActivityStatus.tsx    # Team status in control room
    └── DeptMetrics.tsx           # Department-specific metrics
```

### 📄 **Files to Modify**

```
src/app/
├── service-desk/page.tsx         # Add Approvals Hub tab
├── command-center/page.tsx       # Replace KPI grid with timeline
└── departments/[id]/workspace/page.tsx # Add context + control room

src/components/
├── layout/TopBar.tsx             # Add agent status widget
├── layout/IconRail.tsx           # Add agent orchestration link
└── command-palette/CommandPalette.tsx # Enhance with context search

src/stores/
├── approvalStore.ts              # NEW: Approval state
└── agentStore.ts                 # ENHANCE: Real-time agent status

src/services/
├── approval.service.ts           # NEW: Approval API calls
├── agent-orchestration.service.ts # NEW: Agent status polling
└── command-registry.ts           # ENHANCE: Add new commands
```

---

## TESTING STRATEGY

### 🧪 **Unit Tests**

```typescript
// src/components/approvals/__tests__/ApprovalCard.test.tsx
describe('ApprovalCard', () => {
  it('should display risk badge based on riskLevel', () => {
    render(<ApprovalCard approval={{ riskLevel: 'HIGH' }} />);
    expect(screen.getByText('HIGH RISK')).toBeInTheDocument();
  });
  
  it('should show confidence score and reasoning', () => {
    const approval = { 
      aiRecommendation: { confidence: 87, reasoning: 'Budget aligned...' } 
    };
    render(<ApprovalCard approval={approval} />);
    expect(screen.getByText('87%')).toBeInTheDocument();
  });
});
```

### 📊 **Integration Tests**

```typescript
// tests/approvals-hub.e2e.ts
describe('Approvals Hub', () => {
  it('should batch approve routine items', async () => {
    // 1. Navigate to service-desk?tab=approvals-hub
    // 2. Verify routine items shown
    // 3. Click batch approve
    // 4. Confirm all approved
    // 5. Verify UI updated
  });
  
  it('should collect feedback on rejection', async () => {
    // 1. Find critical approval
    // 2. Click Reject
    // 3. Fill feedback form
    // 4. Submit
    // 5. Verify feedback stored
  });
});
```

### 🎯 **UX Testing**

- Conduct approval workflow testing with 3-5 finance/ops users
- Measure: Time to approval, confusion points, trust in AI scores
- Target: Reduce approval time from 5 min to <2 min; increase confidence from 65% → 85%

---

## DEPLOYMENT & ROLLOUT

### 🚀 **Phase-Gate Deployment**

**Phase 1 Release** (Week 2):
- [ ] Risk-stratified approvals
- [ ] Feature flag: `NEXT_PUBLIC_APPROVALS_V2=true`
- [ ] Canary: 10% of users
- [ ] Monitor: Approval time, error rates, user sentiment
- [ ] Rollout: 100% if metrics positive

**Phase 2 Release** (Week 4):
- [ ] Impact timeline
- [ ] Cross-dept context
- [ ] Feature flag: `NEXT_PUBLIC_DASHBOARD_V2=true`
- [ ] Canary: 25% of users
- [ ] Full rollout: Week 5

### 📊 **Success Metrics**

```typescript
interface RolloutMetrics {
  // UX Metrics
  avgApprovalTime: number; // Target: <2 min (from 5 min)
  batchApprovalRate: number; // Target: >40%
  userConfidenceInAI: number; // 1-5 scale, target: 4.2
  rejectionRate: number; // Target: <10% for high-confidence items
  
  // Business Metrics
  decisionAccuracy: number; // Won/lost deals, target: >75%
  errorReduction: number; // % fewer incorrect approvals
  timeToMarket: number; // Deal close time
  userAdoption: number; // % using new features, target: >80% week 2
}
```

---

## SUMMARY OF CHANGES

| Component | Current | Target | Effort |
|-----------|---------|--------|--------|
| **Approvals UI** | Basic list | Evidence-based, risk-stratified | 🟡 Medium |
| **Dashboard** | Static KPIs | Impact timeline | 🟡 Medium |
| **Navigation** | Functional | Intelligent, adaptive | 🟢 Low |
| **Agent Visibility** | Hidden | Real-time orchestration | 🟡 Medium |
| **Cross-Dept** | Siloed | Contextualized threads | 🔴 High |
| **Learning** | Manual | Feedback loop + retraining | 🟡 Medium |
| **Mobile** | Works | Optimized | 🟡 Medium |
| **Performance** | Good | Excellent (real-time) | 🟢 Low |
| **Dark Mode** | ✓ | ✓ | — |
| **TypeScript** | ✓ | ✓ | — |

---

## QUICK START: WEEK 1 CHECKLIST

- [ ] **Backend**: Add `risk_level` + `ai_recommendation` JSON to approvals
- [ ] **Backend**: Create `/approvals/stratified` endpoint
- [ ] **Frontend**: Create `ApprovalCard.tsx` component
- [ ] **Frontend**: Build `ApprovalHub.tsx` page
- [ ] **Frontend**: Add WebSocket listener for approval updates
- [ ] **Testing**: Approval flow e2e test
- [ ] **Docs**: Update README with new approval flows
- [ ] **Deploy**: Feature flag `APPROVALS_V2` to 10% canary

This positions NeureCore to meet the Design Recommendations by **Week 6** with all Phase 1-2 features shipped and validated.
