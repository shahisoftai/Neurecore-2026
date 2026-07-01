# NeureCore Tool Inventory — CEO Use Cases

## Overview
This document enumerates every tool a Company CEO (or admin user) might need to execute via AI chat in NeureCore. Tools are organized by domain and rated by priority (P0 = MVP, P1 = next iteration, P2 = future).

---

## 1. Department Management (P0)

| Tool | Description | Input |
|------|-------------|-------|
| `createDepartment` | Create a new department | `name`, `description?`, `parentId?` |
| `listDepartments` | List all departments | `parentId?`, `includeArchived?` |
| `getDepartment` | Get department details + agents + projects | `departmentId` |
| `updateDepartment` | Update department name/description | `departmentId`, `name?`, `description?` |
| `archiveDepartment` | Archive (soft-delete) a department | `departmentId` |
| `deleteDepartment` | Permanently delete empty department | `departmentId` |
| `assignManager` | Assign an agent as department head | `departmentId`, `agentId` |
| `unassignManager` | Remove department head | `departmentId` |

---

## 2. Agent / Employee Management (P0)

| Tool | Description | Input |
|------|-------------|-------|
| `createAgent` | Create a new agent (employee) | `name`, `email`, `departmentId`, `role?`, `permissions?` |
| `listAgents` | List agents with filters | `departmentId?`, `status?`, `role?`, `limit?` |
| `getAgent` | Get agent profile + current tasks/projects | `agentId` |
| `updateAgent` | Update agent details | `agentId`, `name?`, `email?`, `role?` |
| `pauseAgent` | Temporarily disable agent login | `agentId`, `reason?` |
| `resumeAgent` | Re-enable paused agent | `agentId` |
| `archiveAgent` | Soft-delete agent | `agentId` |
| `assignAgentToDepartment` | Move agent to different department | `agentId`, `departmentId` |
| `assignAgentToProject` | Add agent to a project | `agentId`, `projectId`, `role?` |
| `removeAgentFromProject` | Remove agent from project | `agentId`, `projectId` |
| `bulkCreateAgents` | Create multiple agents from list | `agents: Array<{name, email, departmentId, role?}>` |
| `bulkAssignToDepartment` | Move multiple agents | `agentIds[]`, `departmentId` |
| `getAgentPerformance` | Get agent KPI / productivity metrics | `agentId`, `fromDate?`, `toDate?` |
| `getAgentWorkload` | Get agent's current task count / utilization | `agentId` |

---

## 3. Project Management (P0)

| Tool | Description | Input |
|------|-------------|-------|
| `createProject` | Create a new project | `name`, `departmentId`, `description?`, `priority?`, `deadline?` |
| `listProjects` | List projects with filters | `departmentId?`, `status?`, `priority?`, `assignedAgentId?`, `limit?` |
| `getProject` | Get project details + tasks + agents | `projectId` |
| `updateProject` | Update project metadata | `projectId`, `name?`, `description?`, `priority?`, `deadline?`, `status?` |
| `archiveProject` | Archive a project | `projectId` |
| `deleteProject` | Permanently delete empty project | `projectId` |
| `assignProjectManager` | Set project manager | `projectId`, `agentId` |
| `addAgentToProject` | Add agent with role | `projectId`, `agentId`, `projectRole?` |
| `removeAgentFromProject` | Remove agent from project | `projectId`, `agentId` |
| `setProjectPriority` | Change project priority | `projectId`, `priority: LOW/MEDIUM/HIGH/CRITICAL` |
| `getProjectTimeline` | Get Gantt-style timeline data | `projectId` |
| `getProjectBurndown` | Get task completion burndown | `projectId` |
| `cloneProject` | Duplicate project with tasks (optionally) | `projectId`, `newName`, `includeTasks?` |

---

## 4. Task Management (P0)

| Tool | Description | Input |
|------|-------------|-------|
| `createTask` | Create a new task | `title`, `departmentId?`, `projectId?`, `priority?`, `assigneeId?`, `dueDate?`, `description?` |
| `listTasks` | List tasks with filters | `projectId?`, `departmentId?`, `assigneeId?`, `status?`, `priority?`, `dueBefore?`, `dueAfter?`, `limit?` |
| `getTask` | Get task details | `taskId` |
| `updateTask` | Update task fields | `taskId`, `title?`, `description?`, `priority?`, `dueDate?`, `status?`, `assigneeId?` |
| `deleteTask` | Delete a task | `taskId` |
| `assignTask` | Assign task to agent | `taskId`, `assigneeId` |
| `unassignTask` | Remove assignee from task | `taskId` |
| `markTaskComplete` | Mark task as done | `taskId` |
| `markTaskInProgress` | Move task to IN_PROGRESS | `taskId` |
| `markTaskBlocked` | Move task to BLOCKED | `taskId`, `blockReason?` |
| `reopenTask` | Reopen a completed task | `taskId` |
| `changeTaskPriority` | Change priority | `taskId`, `priority` |
| `setTaskDueDate` | Set/update due date | `taskId`, `dueDate` |
| `addSubtask` | Create subtask under parent | `taskId`, `title`, `priority?`, `assigneeId?` |
| `listSubtasks` | Get subtasks of a task | `taskId` |
| `getMyTasks` | Get tasks assigned to current user | `status?`, `priority?`, `limit?` |
| `getOverdueTasks` | Get all overdue tasks | `departmentId?`, `projectId?` |
| `bulkAssignTasks` | Assign multiple tasks to agent | `taskIds[]`, `assigneeId` |
| `bulkChangeStatus` | Change status of multiple tasks | `taskIds[]`, `status` |
| `cloneTask` | Duplicate a task | `taskId`, `newAssigneeId?` |

---

## 5. Approval Workflow (P1)

| Tool | Description | Input |
|------|-------------|-------|
| `listPendingApprovals` | Get all pending approval requests | `departmentId?`, `type?`, `limit?` |
| `getApproval` | Get approval request details | `approvalId` |
| `approveRequest` | Approve a request | `approvalId`, `comment?` |
| `rejectRequest` | Reject a request | `approvalId`, `reason` |
| `bulkApprove` | Approve multiple requests at once | `approvalIds[]` |
| `bulkReject` | Reject multiple requests | `approvalIds[]`, `reason` |
| `createApprovalRequest` | Submit a new approval request | `type`, `targetId`, `departmentId`, `reason?` |
| `getMyPendingApprovals` | Get approvals assigned to me | `limit?` |
| `resubmitApproval` | Resubmit rejected request | `approvalId` |
| `cancelApprovalRequest` | Cancel my pending request | `approvalId` |

---

## 6. Budget & Cost Management (P1)

| Tool | Description | Input |
|------|-------------|-------|
| `getDepartmentBudget` | Get budget summary for department | `departmentId` |
| `getProjectBudget` | Get budget consumed vs total for project | `projectId` |
| `setDepartmentBudget` | Set/update department budget | `departmentId`, `amount`, `period` |
| `setProjectBudget` | Set budget cap for project | `projectId`, `amount` |
| `getCostReport` | Get cost breakdown | `fromDate`, `toDate`, `groupBy?` |
| `getCostByDepartment` | Get costs grouped by department | `fromDate?`, `toDate?` |
| `getCostByAgent` | Get costs per agent | `fromDate?`, `toDate?` |
| `getCostByProject` | Get costs per project | `fromDate?`, `toDate?` |
| `setBudgetAlert` | Configure budget threshold alert | `departmentId?`, `projectId?`, `thresholdPercent`, `email?` |
| `listBudgetAlerts` | Get active budget alerts | `departmentId?` |
| `acknowledgeBudgetAlert` | Mark alert as seen | `alertId` |
| `getTodayCost` | Get today's total platform cost | — |

---

## 7. Company & Tenant Settings (P1)

| Tool | Description | Input |
|------|-------------|-------|
| `getCompanyProfile` | Get company name, logo, settings | — |
| `updateCompanyProfile` | Update company details | `name?`, `logoUrl?`, `website?`, `contactEmail?` |
| `getTenantSettings` | Get tenant config (features flags, limits) | — |
| `updateTenantSettings` | Update tenant settings | `settings object` |
| `getApiKeys` | List active API keys | — |
| `createApiKey` | Generate new API key | `name`, `scopes[]` |
| `revokeApiKey` | Invalidate an API key | `keyId` |
| `getUsageStats` | Get API usage statistics | `fromDate?`, `toDate?` |

---

## 8. Roles & Permissions (P1)

| Tool | Description | Input |
|------|-------------|-------|
| `listRoles` | List all roles | — |
| `createRole` | Create a new role | `name`, `permissions[]` |
| `updateRole` | Update role permissions | `roleId`, `permissions[]` |
| `deleteRole` | Delete custom role | `roleId` |
| `assignRole` | Assign role to agent | `agentId`, `roleId` |
| `unassignRole` | Remove role from agent | `agentId`, `roleId` |
| `listAgentPermissions` | Get effective permissions for agent | `agentId` |
| `getPermissionMatrix` | Get full RBAC matrix | — |

---

## 9. Notifications & Alerts (P1)

| Tool | Description | Input |
|------|-------------|-------|
| `sendNotification` | Send notification to agent(s) | `agentIds[]` or `departmentId`, `message`, `type?` |
| `broadcastAnnouncement` | Broadcast to entire company | `title`, `message`, `priority?` |
| `getMyNotifications` | Get my unread notifications | `limit?` |
| `markNotificationRead` | Mark notification as read | `notificationId` |
| `markAllNotificationsRead` | Mark all my notifications as read | — |
| `subscribeToAlert` | Subscribe to budget/overdue alerts | `alertType`, `channel` |
| `unsubscribeFromAlert` | Unsubscribe from alert | `alertType` |

---

## 10. Reporting & Analytics (P1)

| Tool | Description | Input |
|------|-------------|-------|
| `getDashboardSummary` | Get command-center summary snapshot | — |
| `getAgentLeaderboard` | Rank agents by productivity | `fromDate?`, `toDate?`, `metric?` |
| `getProjectProgressReport` | Get completion % for all projects | `departmentId?` |
| `getTaskCompletionTrend` | Get task completion over time | `fromDate`, `toDate`, `groupBy?` |
| `getDepartmentHealth` | Get health score per department | `departmentId` |
| `getOverdueTaskReport` | List all overdue tasks with owners | `departmentId?`, `projectId?` |
| `getTimeToCompletion` | Average time from created → completed | `fromDate?`, `toDate?` |
| `getBurnoutRisk` | Flag agents with high workload | `threshold?` |
| `exportReport` | Export report as CSV/JSON | `reportType`, `fromDate`, `toDate`, `format` |

---

## 11. Inbox / Requests Management (P1)

| Tool | Description | Input |
|------|-------------|-------|
| `getInboxSummary` | Get my inbox counts by type | — |
| `listInboxItems` | List my inbox items | `type?`, `status?`, `limit?` |
| `getInboxItem` | Get inbox item detail | `itemId` |
| `respondToInboxItem` | Approve/reject/respond | `itemId`, `action`, `comment?` |

---

## 12. Workflow / Automation (P2)

| Tool | Description | Input |
|------|-------------|-------|
| `createWorkflow` | Define a multi-step workflow | `name`, `steps[]`, `triggers[]` |
| `listWorkflows` | List all workflows | `status?` |
| `enableWorkflow` | Activate a workflow | `workflowId` |
| `disableWorkflow` | Deactivate a workflow | `workflowId` |
| `triggerWorkflow` | Manually trigger a workflow | `workflowId`, `context?` |
| `getWorkflowRuns` | Get execution history | `workflowId`, `limit?` |

---

## 13. Data Export / Sync (P2)

| Tool | Description | Input |
|------|-------------|-------|
| `exportDepartmentData` | Export all department data | `departmentId`, `format?` |
| `exportProjectData` | Export project + tasks | `projectId`, `format?` |
| `syncWithExternalSystem` | Trigger external ERP/HRMS sync | `systemType`, `direction` |
| `getSyncStatus` | Get last sync status | `systemType` |

---

## 14. Audit & Compliance (P2)

| Tool | Description | Input |
|------|-------------|-------|
| `getAuditLog` | Get audit trail | `fromDate?`, `toDate?`, `actorId?`, `actionType?`, `limit?` |
| `searchAuditLog` | Full-text search audit entries | `query`, `fromDate?`, `toDate?` |
| `getComplianceReport` | Generate compliance report | `standard` (e.g., SOC2), `fromDate`, `toDate` |
| `exportAuditLog` | Export audit log | `fromDate`, `toDate`, `format` |

---

## 15. Communication (P2)

| Tool | Description | Input |
|------|-------------|-------|
| `sendEmail` | Send email to agent(s) | `to[]`, `subject`, `body` |
| `scheduleAnnouncement` | Schedule company-wide announcement | `title`, `message`, `scheduledAt` |
| `getAnnouncementHistory` | Get past announcements | `limit?` |
| `createTeamChannel` | Create a messaging channel | `name`, `members[]` |
| `addMemberToChannel` | Add member to channel | `channelId`, `agentId` |

---

## Priority Summary

| Priority | Tools |
|----------|-------|
| **P0 (MVP — done/doing)** | `createTask`, `createProject`, `listDepartments`, `listAgents`, `pauseAgent`, `resumeAgent`, `listTasks`, `getTenantSnapshot` |
| **P1 (next iteration)** | All Department tools, remaining Agent tools, Project tools, Task tools, Approval tools, Budget tools, Company Settings, Roles, Notifications, Reporting, Inbox |
| **P2 (future)** | Workflow/Automation, Data Export/Sync, Audit/Compliance, Communication tools |

---

## Tool Naming Convention

All tools follow:
- **Verb-Noun** pattern: `createTask`, `listAgents`, `pauseAgent`
- **CamelCase** for tool name and arguments
- All IDs are UUID strings
- Dates are ISO 8601 strings
- Enums match Prisma enum values exactly (e.g., `TaskPriority.LOW`, not `TaskPriority.LOWEST`)
