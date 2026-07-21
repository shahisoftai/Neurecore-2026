# Hermes Tools — Configuration Reference

**Date:** 2026-07-21
**Status:** Current

---

## 1. Overview

Hermes tools are defined in two layers:

1. **Tool Descriptors** (`hermes-tools.ts`) — Metadata descriptors per Hermes agent type defining which tools are available and at what permission level.
2. **Tool Implementations** (`neurecore-tools.ts` + `tools.module.ts`) — Actual NestJS injectable tools registered at boot via `StructuredToolRegistry`.

---

## 2. Tool Permission Levels

| Level | Description |
|-------|-------------|
| `ALLOW` | Unrestricted access |
| `READ_ONLY` | Can only read, not write |
| `APPROVAL_REQUIRED` | Requires human approval before execution |
| `DENY` | Never allowed |

---

## 3. HermesToolSets by Agent Type

Defined in `backend/src/modules/tools/built-in/hermes-tools.ts`:

```typescript
export const HERMES_TOOL_SETS: Record<HermesAgentType, HermesToolDescriptor[]> = {
  HR: [
    { name: 'email', description: 'Send and read emails', permission: ALLOW },
    { name: 'calendar', description: 'Schedule and manage calendar events', permission: ALLOW },
    { name: 'documents', description: 'Read and create HR documents', permission: ALLOW },
    { name: 'tasks', description: 'Create and manage onboarding tasks', permission: ALLOW },
    { name: 'query', description: 'Query HR data (read-only)', permission: READ_ONLY },
    { name: 'reports', description: 'Generate HR reports', permission: ALLOW },
    { name: 'terminate_employee', description: 'Terminate an employee record', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'FIRE', minApprovers: 3 } },
    { name: 'update_payroll', description: 'Update payroll information', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'BUDGET', minApprovers: 2 } },
  ],

  FINANCE: [
    { name: 'email', description: 'Send and read emails', permission: ALLOW },
    { name: 'query', description: 'Query financial data (read-only)', permission: READ_ONLY },
    { name: 'reports', description: 'Generate financial reports', permission: ALLOW },
    { name: 'documents', description: 'Read and create financial documents', permission: ALLOW },
    { name: 'sheets', description: 'Create and manage spreadsheets', permission: ALLOW },
    { name: 'calendar', description: 'Schedule and manage calendar events', permission: ALLOW },
    { name: 'process_invoice', description: 'Process and approve invoices', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'VENDOR_PAYMENT', thresholdUsd: 1000 } },
    { name: 'execute_payment', description: 'Execute vendor payments', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'VENDOR_PAYMENT', thresholdUsd: 5000, minApprovers: 2 } },
    { name: 'approve_expense', description: 'Approve expense reports', permission: ALLOW },
    { name: 'sync_erp', description: 'Sync data to ERP system', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'CUSTOM', minApprovers: 1 } },
  ],

  SALES: [
    { name: 'email', description: 'Send and read emails', permission: ALLOW },
    { name: 'calendar', description: 'Schedule meetings and demos', permission: ALLOW },
    { name: 'documents', description: 'Read and create sales documents', permission: ALLOW },
    { name: 'query', description: 'Query CRM data', permission: READ_ONLY },
    { name: 'reports', description: 'Generate sales reports', permission: ALLOW },
    { name: 'create_deal', description: 'Create CRM deals', permission: ALLOW },
    { name: 'update_contact', description: 'Update CRM contacts', permission: ALLOW },
    { name: 'generate_quote', description: 'Generate sales quotes', permission: ALLOW },
    { name: 'apply_discount', description: 'Apply discounts to quotes', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'BUDGET', maxDiscountPct: 20 } },
  ],

  MARKETING: [
    { name: 'email', description: 'Send marketing emails', permission: ALLOW },
    { name: 'documents', description: 'Read and create marketing content', permission: ALLOW },
    { name: 'query', description: 'Query marketing analytics', permission: READ_ONLY },
    { name: 'reports', description: 'Generate marketing reports', permission: ALLOW },
    { name: 'sheets', description: 'Create and manage spreadsheets', permission: ALLOW },
    { name: 'calendar', description: 'Schedule and manage calendar events', permission: ALLOW },
    { name: 'http_request', description: 'Call external marketing APIs', permission: ALLOW },
    { name: 'publish_content', description: 'Publish marketing content externally', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'CUSTOM', minApprovers: 1 } },
  ],

  LEGAL: [
    { name: 'email', description: 'Send and read emails', permission: ALLOW },
    { name: 'documents', description: 'Read and create legal documents', permission: ALLOW },
    { name: 'query', description: 'Query compliance data (read-only)', permission: READ_ONLY },
    { name: 'sign_contract', description: 'Sign contracts on behalf of organization', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'CONTRACT', minApprovers: 2 } },
    { name: 'generate_nda', description: 'Generate NDA documents', permission: ALLOW },
    { name: 'check_compliance', description: 'Check regulatory compliance', permission: READ_ONLY },
  ],

  RESEARCH: [
    { name: 'http_request', description: 'Fetch external data', permission: ALLOW },
    { name: 'documents', description: 'Read and create research documents', permission: ALLOW },
    { name: 'query', description: 'Query internal knowledge base', permission: READ_ONLY },
    { name: 'reports', description: 'Generate research reports', permission: ALLOW },
    { name: 'sheets', description: 'Create and manage spreadsheets', permission: ALLOW },
    { name: 'calculator', description: 'Perform calculations', permission: ALLOW },
  ],

  ENGINEERING: [
    { name: 'documents', description: 'Read and create technical docs', permission: ALLOW },
    { name: 'query', description: 'Query engineering data', permission: READ_ONLY },
    { name: 'tasks', description: 'Create and manage engineering tasks', permission: ALLOW },
    { name: 'http_request', description: 'Call external APIs', permission: ALLOW },
    { name: 'calculator', description: 'Perform calculations', permission: ALLOW },
  ],

  QA: [
    { name: 'documents', description: 'Read and create QA documents', permission: ALLOW },
    { name: 'query', description: 'Query test data', permission: READ_ONLY },
    { name: 'tasks', description: 'Create bug reports and QA tasks', permission: ALLOW },
    { name: 'reports', description: 'Generate QA reports', permission: ALLOW },
  ],

  SECURITY: [
    { name: 'query', description: 'Query security logs (read-only)', permission: READ_ONLY },
    { name: 'reports', description: 'Generate security reports', permission: ALLOW },
    { name: 'email', description: 'Send security alerts', permission: ALLOW },
    { name: 'block_resource', description: 'Block access to a resource', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'DATA_ACCESS', minApprovers: 1 } },
  ],

  OPERATIONS: [
    { name: 'email', description: 'Send and read emails', permission: ALLOW },
    { name: 'calendar', description: 'Schedule operational events', permission: ALLOW },
    { name: 'documents', description: 'Operational documentation', permission: ALLOW },
    { name: 'query', description: 'Query operational data', permission: READ_ONLY },
    { name: 'tasks', description: 'Create and manage operational tasks', permission: ALLOW },
    { name: 'reports', description: 'Generate operations reports', permission: ALLOW },
    { name: 'sheets', description: 'Create and manage spreadsheets', permission: ALLOW },
  ],

  CUSTOMER_SUPPORT: [
    { name: 'email', description: 'Send and read support emails', permission: ALLOW },
    { name: 'query', description: 'Query customer data (read-only)', permission: READ_ONLY },
    { name: 'documents', description: 'Access knowledge base', permission: READ_ONLY },
    { name: 'tasks', description: 'Create support tickets', permission: ALLOW },
    { name: 'process_refund', description: 'Process customer refunds', permission: APPROVAL_REQUIRED, conditions: { approvalType: 'REFUND', thresholdUsd: 1000 } },
  ],

  PROJECT_DISCOVERY: [
    { name: 'interview_ask_next', description: 'Return the next discovery question + prompt for a project', permission: ALLOW },
    { name: 'interview_parse_reply', description: 'Parse a free-form reply into InformationResponse rows', permission: ALLOW },
    { name: 'document_extract', description: 'Extract candidate answers from an uploaded document', permission: ALLOW },
    { name: 'document_accept_candidates', description: 'Persist user-accepted extraction candidates into the engine', permission: ALLOW },
    { name: 'completeness_get', description: 'Read EntityCompleteness for a project', permission: READ_ONLY },
    { name: 'resolved_requirements_get', description: 'Read the flat resolved question list for a project', permission: READ_ONLY },
    { name: 'record_response', description: 'Record a single InformationResponse (one-question write)', permission: ALLOW },
  ],

  CHIEF_OF_STAFF: [
    { name: 'project_memory_add', description: 'Add a memory entry to a project', permission: ALLOW },
    { name: 'project_memory_search', description: 'Search project memory by keyword', permission: READ_ONLY },
    { name: 'project_memory_update_confidence', description: 'Update the confidence score of a memory entry', permission: ALLOW },
    { name: 'getProject', description: 'Read a project by ID', permission: READ_ONLY },
    { name: 'getTask', description: 'Read a task by ID', permission: READ_ONLY },
    { name: 'completeness_get', description: 'Read completeness score for a project', permission: READ_ONLY },
    { name: 'record_response', description: 'Record an information response for a project', permission: ALLOW },
  ],

  CUSTOM: [
    { name: 'email', description: 'Email operations', permission: ALLOW },
    { name: 'documents', description: 'Document operations', permission: ALLOW },
    { name: 'query', description: 'Query data', permission: READ_ONLY },
    { name: 'sheets', description: 'Spreadsheet operations', permission: ALLOW },
    { name: 'calendar', description: 'Calendar operations', permission: ALLOW },
  ],
};
```

---

## 4. ai-assistant Tool Allowlist (Security Policy Provider)

Defined in `backend/src/modules/agents/security/providers/security-policy.provider.ts`:

The `ai-assistant` agent type has an explicit allowlist of **91 tools** (expanded from original set):

### Project Operations (create/list/get only)
- `createProject`
- `getProject`
- `getProjectByName`
- `listProjects`
- `searchProjects`
- `updateProjectStatus`
- `addProjectMember`
- `removeProjectMember`
- `listProjectMembers`
- `listProjectStages`
- `updateProjectStage`

### Task Operations (create/list/get only)
- `createTask`
- `getTask`
- `getMyTasks`
- `getOverdueTasks`
- `listSubtasks`
- `searchTasks`
- `getTaskStats`

### Department Operations (read-only)
- `listDepartments`
- `getDepartment`
- `listDepartmentMembers`

### Agent Operations (read-only and state control)
- `listAgents`
- `getAgent`
- `getAgentWorkload`
- `pauseAgent`
- `resumeAgent`
- `listAgentsByDepartment`
- `searchAgents`

### Workflows
- `listWorkflows`
- `getWorkflow`

### Goals
- `listGoals`
- `updateGoalProgress`

### Budget Policies
- `listBudgetPolicies`

### Tenant and Company
- `getTenantSnapshot`
- `getCompanyProfile`
- `getTenantSettings`

### Notifications
- `getMyNotifications`
- `markNotificationRead`
- `markAllNotificationsRead`

### Dashboard and Reporting
- `getDashboardSummary`
- `getOverdueTaskReport`

### Inbox
- `getInboxSummary`
- `listInboxItems`
- `getInboxItem`
- `respondToInboxItem`

### Approvals (read-only)
- `listPendingApprovals`
- `getApproval`
- `getMyPendingApprovals`

### Finance (read-only)
- `getCostReport`
- `getCostByDepartment`
- `getCostByAgent`
- `getCostByProject`
- `getTodayCost`
- `setBudgetAlert`

### Customers (read-only)
- `getCustomer`
- `listCustomers`
- `findCustomerByName`
- `getCustomerProjects`
- `listCustomerContacts`

### Activity
- `listAllNotifications`
- `getActivityFeed`
- `listMyApprovalHistory`

### Global Search
- `globalSearch`

### Project Memory
- `addProjectMemory`
- `searchProjectMemory`
- `updateMemoryConfidence`

### Blocked Tools (Deny list)
- Shell: `shell`, `bash`, `exec`
- File: `file.read`, `file.write`, `file.delete`
- Network: `http.request`, `database.query`, `database.modify`
- Destructive mutations: `deleteProject`, `archiveProject`, `cloneProject`, `updateProject`, `deleteTask`, `updateTask`, `cloneTask`, `markTaskComplete`, `markTaskInProgress`, `reopenTask`, `changeTaskPriority`, `bulkAssignTasks`, `bulkChangeStatus`, `assignTask`, `unassignTask`, `addSubtask`
- Department: `deleteDepartment`, `archiveDepartment`, `updateDepartment`, `assignManager`, `unassignManager`
- Agent: `updateAgent`, `archiveAgent`, `assignAgentToDepartment`, `removeAgentFromProject`, `bulkCreateAgents`, `bulkAssignToDepartment`
- Approval mutations: `approveRequest`, `rejectRequest`, `bulkApprove`, `bulkReject`, `createApprovalRequest`, `resubmitApproval`, `cancelApprovalRequest`
- Company/Customer mutations: `updateCompanyProfile`, `updateCustomer`, `archiveCustomer`, `unarchiveCustomer`

---

## 5. Tool Implementation Registry

### Built-in Tools (`tools.module.ts` imports — 119 total tools)

**Infrastructure Tools:**
- `HttpRequestTool` — External HTTP requests
- `CalculatorTool` — Basic calculations
- `CalculatorEnhancedTool` — Enhanced calculations
- `HttpRequestEnhancedTool` — Enhanced HTTP requests

**Communication Tools:**
- `EmailTool` — Email operations
- `ChatTool` — Chat operations
- `CalendarTool` — Calendar operations

**Data Tools:**
- `DocumentsTool` — Document operations
- `ReportsTool` — Report generation
- `QueryTool` — Data queries
- `ExplainTool` — Explanation generation
- `ContextTool` — Context operations
- `SheetsTool` — Spreadsheet operations

**NeureCore Platform Tools (91 from `neurecore-tools.ts`):**

| Category | Tools |
|----------|-------|
| **P0** | `CreateTaskTool`, `CreateProjectTool`, `ListDepartmentsTool`, `ListAgentsTool`, `PauseAgentTool`, `ResumeAgentTool`, `ListTasksTool`, `GetTenantSnapshotTool` |
| **P1: Department** | `UpdateDepartmentTool`, `ArchiveDepartmentTool`, `DeleteDepartmentTool`, `AssignManagerTool`, `UnassignManagerTool` |
| **P1: Agent** | `GetAgentTool`, `UpdateAgentTool`, `ArchiveAgentTool`, `AssignAgentToDepartmentTool`, `RemoveAgentFromProjectTool`, `BulkCreateAgentsTool`, `BulkAssignToDepartmentTool`, `GetAgentWorkloadTool` |
| **P1: Project** | `GetProjectTool`, `UpdateProjectTool`, `ArchiveProjectTool`, `DeleteProjectTool`, `CloneProjectTool` |
| **P1: Task** | `GetTaskTool`, `UpdateTaskTool`, `DeleteTaskTool`, `AssignTaskTool`, `UnassignTaskTool`, `MarkTaskCompleteTool`, `MarkTaskInProgressTool`, `ReopenTaskTool`, `ChangeTaskPriorityTool`, `AddSubtaskTool`, `ListSubtasksTool`, `GetMyTasksTool`, `GetOverdueTasksTool`, `BulkAssignTasksTool`, `BulkChangeStatusTool`, `CloneTaskTool` |
| **P1: Approval** | `ListPendingApprovalsTool`, `GetApprovalTool`, `ApproveRequestTool`, `RejectRequestTool`, `BulkApproveTool`, `BulkRejectTool`, `CreateApprovalRequestTool`, `GetMyPendingApprovalsTool`, `ResubmitApprovalTool`, `CancelApprovalRequestTool` |
| **P1: Budget** | `GetCostReportTool`, `GetCostByDepartmentTool`, `GetCostByAgentTool`, `GetCostByProjectTool`, `SetBudgetAlertTool`, `GetTodayCostTool` |
| **P1: Company** | `GetCompanyProfileTool`, `UpdateCompanyProfileTool`, `GetTenantSettingsTool` |
| **P1: Notification** | `GetMyNotificationsTool`, `MarkNotificationReadTool`, `MarkAllNotificationsReadTool` |
| **P1: Reporting** | `GetDashboardSummaryTool`, `GetOverdueTaskReportTool` |
| **P1: Inbox** | `GetInboxSummaryTool`, `ListInboxItemsTool`, `GetInboxItemTool`, `RespondToInboxItemTool` |
| **Phase 3D: Project Memory** | `AddProjectMemoryTool`, `SearchProjectMemoryTool`, `UpdateMemoryConfidenceTool` |
| **Customer** | `CreateCustomerTool`, `UpdateCustomerTool`, `GetCustomerTool`, `ListCustomersTool`, `FindCustomerByNameTool`, `ArchiveCustomerTool`, `UnarchiveCustomerTool` |
| **Project Extended** | `ListProjectsTool`, `SearchProjectsTool`, `GetProjectByNameTool`, `UpdateProjectStatusTool`, `AddProjectMemberTool`, `RemoveProjectMemberTool`, `ListProjectMembersTool`, `ListProjectStagesTool`, `UpdateProjectStageTool` |
| **Workflow/Goals** | `ListWorkflowsTool`, `GetWorkflowTool`, `ListGoalsTool`, `UpdateGoalProgressTool`, `ListBudgetPoliciesTool` |
| **Department Extended** | `GetDepartmentTool`, `ListDepartmentMembersTool`, `ListAgentsByDepartmentTool`, `SearchAgentsTool` |
| **Customer Extended** | `GetCustomerProjectsTool`, `ListCustomerContactsTool` |
| **Activity** | `ListAllNotificationsTool`, `GetActivityFeedTool`, `ListMyApprovalHistoryTool`, `SearchTasksTool`, `GetTaskStatsTool`, `GlobalSearchTool` |

---

## 6. Key Files

| File | Purpose |
|------|---------|
| `backend/src/modules/tools/built-in/hermes-tools.ts` | HermesToolDescriptor definitions per agent type |
| `backend/src/modules/tools/built-in/neurecore-tools.ts` | 91 NeureCore platform tool implementations (4129 lines) |
| `backend/src/modules/tools/tools.module.ts` | Tool registry + 119 tool registrations |
| `backend/src/modules/tools/structured-tool.registry.ts` | `getFunctionDefinitions(allowedNames?)` overload |
| `backend/src/modules/tools/interfaces/structured-tool.interface.ts` | Tool interface definitions |
| `backend/src/modules/agents/security/providers/security-policy.provider.ts` | `ai-assistant` explicit allowlist |
| `backend/src/modules/hermes/services/tool-gateway.service.ts` | Unknown tool returns `{ allowed: false }` |
| `backend/src/modules/hermes/services/hermes-runtime.service.ts` | `allowedTools` passthrough, `step.success/error` fields, `lastFinalChunk` tracking |

---

## 7. `createProject` Tool Schema

**File:** `CreateProjectInputSchema` in `neurecore-tools.ts`

```typescript
export const CreateProjectInputSchema = z.object({
  name: z.string().min(1),                          // Required
  description: z.string().optional(),
  departmentId: z.string().optional(),
  customerId: z.string().optional(),
  projectTypeId: z.string().optional(),             // Template-driven pipeline
  projectTypeVersion: z.number().int().positive().optional(),
  budgetType: z.enum(['FIXED_FEE', 'HOURLY', 'RETAINER']).optional(),
  budgetAmount: z.coerce.number().positive().optional(),
  budgetCurrency: z.string().length(3).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  targetDate: z.string().optional(),
  useAiSynthesis: z.boolean().default(true),         // Hermes-driven synthesis (default)
  industryHint: z.string().max(80).optional(),
});
```

**Key behaviors:**
- `budgetType` accepts `FIXED_FEE/HOURLY/RETAINER` or lowercase variants (`fixed`, `fixed_fee`, `fixed-fee`)
- `budgetAmount` accepts numeric strings (LLM often sends `"40000"` as string)
- `useAiSynthesis=true` (default) + no `projectTypeId` → Hermes synthesizes project shape via LLM
- `useAiSynthesis=false` + no `projectTypeId` → `ProjectsService.create()` throws "Either projectTypeId or derivedShape is required"

---

## 8. Tool Execution Context

Tools receive `ToolExecutionContext`:

```typescript
interface ToolExecutionContext {
  tenantId: string;
  userId?: string;
  sessionId?: string;
  metadata?: {
    goal?: string;        // Set by langgraph-official.ts for createProject
    [key: string]: unknown;
  };
}
```

---

## 9. Helper Functions

```typescript
// Get tool set for a Hermes type
export function getHermesToolSet(type: HermesAgentType): HermesToolDescriptor[]

// Get all allowed tool names (excludes DENY)
export function getAllowedToolNames(type: HermesAgentType): string[]
```

---

*Last updated: 2026-07-21*
