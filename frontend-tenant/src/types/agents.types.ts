/**
 * src/types/agents.types.ts
 *
 * Frontend shared agent type definitions
 * SOLID: ISP - Segregated interfaces
 */

/**
 * Agent status enum
 */
export type AgentStatus = 'ACTIVE' | 'IDLE' | 'STANDBY' | 'OFFLINE';

/**
 * Agent current task information
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
 * Agent data model
 * SOLID: ISP - Only agent-specific fields
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
 * Orchestration summary
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
 * API response for orchestration endpoint
 */
export interface AgentsOrchestrationResponse {
    agents: Agent[];
    summary: OrchestrationSummary;
    timestamp: string;
}

/**
 * Query options for agents endpoint
 * SOLID: ISP - Only query fields
 */
export interface AgentsQueryOptions {
    filter?: 'all' | 'active' | 'idle' | 'offline';
    sort?: 'name' | 'status' | 'performance';
    limit?: number;
    offset?: number;
}
