/**
 * src/components/agents/types.ts - Frontend agent component types
 *
 * SOLID: ISP - Separate interfaces for different concerns
 */

/**
 * Props for AgentCard component
 * SOLID: SRP - Only agent card-related props
 */
export interface AgentCardProps {
    id: string;
    name: string;
    department: {
        id: string;
        name: string;
        icon?: string;
    };
    status: 'ACTIVE' | 'IDLE' | 'STANDBY' | 'OFFLINE';
    currentTask?: {
        title: string;
        progress: number; // 0-100
        eta: number; // seconds
        reasoning: string;
    };
    queue: number;
    performance: {
        completedToday: number;
        accuracy: number; // 0-100
        avgCompletionTime: number; // seconds
    };
    onViewDetails?: () => void;
}

/**
 * Props for AgentOrchestrationBoard component
 * SOLID: ISP - Only board-related props
 */
export interface AgentOrchestrationBoardProps {
    agents: AgentCardProps[];
    summary: {
        totalOnline: number;
        totalOffline: number;
        activelyWorking: number;
        idle: number;
        standby: number;
    };
    isLoading?: boolean;
    filter?: 'all' | 'active' | 'idle' | 'offline';
    onFilterChange?: (filter: 'all' | 'active' | 'idle' | 'offline') => void;
    onAgentClick?: (agentId: string) => void;
}

/**
 * Props for AgentStatusWidget component
 * SOLID: ISP - Only widget-related props
 */
export interface AgentStatusWidgetProps {
    totalOnline: number;
    totalOffline: number;
    activelyWorking: number;
    onClick?: () => void;
    isLoading?: boolean;
}

/**
 * Props for agent detail modal/drawer
 * SOLID: ISP - Only detail-related props
 */
export interface AgentDetailProps {
    agentId: string;
    name: string;
    department: {
        id: string;
        name: string;
    };
    status: string;
    performance: {
        completedToday: number;
        accuracy: number;
        avgCompletionTime: number;
    };
    currentTask?: {
        title: string;
        progress: number;
        eta: number;
        reasoning: string;
    };
    queue: number;
    onClose?: () => void;
}
