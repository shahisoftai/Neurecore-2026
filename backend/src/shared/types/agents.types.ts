/**
 * src/shared/types/agents.types.ts
 *
 * Shared agent type definitions between frontend and backend
 * SOLID: ISP - Segregated interfaces for different concerns
 */

/**
 * Agent status enum
 */
export enum AgentStatus {
    ACTIVE = 'ACTIVE',
    IDLE = 'IDLE',
    STANDBY = 'STANDBY',
    OFFLINE = 'OFFLINE',
}

/**
 * Agent current task
 * SOLID: ISP - Only task-related fields
 */
export interface AgentTask {
    title: string;
    progress: number; // 0-100
    eta: number; // seconds
    reasoning: string;
}

/**
 * Agent performance metrics
 * SOLID: ISP - Only performance fields
 */
export interface AgentPerformance {
    completedToday: number;
    accuracy: number; // 0-100
    avgCompletionTime: number; // seconds
}

/**
 * Department reference
 * SOLID: ISP - Only department fields
 */
export interface DepartmentRef {
    id: string;
    name: string;
    icon?: string;
}

/**
 * Agent entity
 * SOLID: ISP - Agent-specific fields
 */
export interface Agent {
    id: string;
    name: string;
    department: DepartmentRef;
    status: AgentStatus;
    currentTask?: AgentTask;
    queue: number;
    performance: AgentPerformance;
}

/**
 * Orchestration summary statistics
 * SOLID: ISP - Only summary fields
 */
export interface OrchestrationSummary {
    totalOnline: number;
    totalOffline: number;
    activelyWorking: number;
    idle: number;
    standby: number;
}

/**
 * API response for /agents/orchestration endpoint
 */
export interface AgentsOrchestrationResponse {
    agents: Agent[];
    summary: OrchestrationSummary;
    timestamp: string;
}

/**
 * Query options for agents endpoint
 * SOLID: ISP - Only query-related fields
 */
export interface AgentsQueryOptions {
    filter?: 'all' | 'active' | 'idle' | 'offline';
    sort?: 'name' | 'status' | 'performance';
    limit?: number;
    offset?: number;
}

/**
 * WebSocket message for real-time agent status updates
 */
export interface AgentStatusUpdate {
    agentId: string;
    status: AgentStatus;
    currentTask?: AgentTask;
    queue: number;
    performance: AgentPerformance;
    timestamp: string;
}

/**
 * WebSocket payload for agent orchestration
 */
export interface AgentOrchestrationWebSocketPayload {
    type: 'AGENT_UPDATE' | 'AGENT_OFFLINE' | 'SUMMARY_UPDATE';
    data: AgentStatusUpdate | OrchestrationSummary;
    timestamp: string;
}
