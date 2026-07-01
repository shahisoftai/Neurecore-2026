import {
  ISecurityContext,
  ISecurityValidationResult,
} from '../security/interfaces/security.interfaces';

/**
 * Agent Execution Mode
 */
export enum AgentExecutionMode {
  /** Agent runs in-process (current OpenClaw integration) */
  IN_PROCESS = 'in_process',
  /** Agent runs in Podman container */
  CONTAINERIZED = 'containerized',
}

/**
 * Container Configuration for Agent Execution
 */
export interface ContainerConfig {
  /** Container image to use */
  image: string;
  /** Memory limit (e.g., "512Mi") */
  memoryLimit?: string;
  /** CPU limit (e.g., "500m") */
  cpuLimit?: string;
  /** Workspace size limit for tmpfs */
  workspaceSizeLimit?: string;
  /** Whether container has network access */
  networkEnabled?: boolean;
}

/**
 * Agent Container Status
 */
export interface AgentContainerStatus {
  /** Container name */
  name: string;
  /** Whether container is running */
  running: boolean;
  /** Current memory usage */
  memoryUsage?: string;
  /** Current CPU usage */
  cpuUsage?: string;
  /** Container uptime */
  uptime?: string;
}

/**
 * Containerized Agent Result
 */
export interface ContainerizedAgentResult {
  /** Exit code from agent execution */
  exitCode: number;
  /** Agent output */
  output: string;
  /** Error message if any */
  error?: string;
  /** Execution duration in ms */
  duration: number;
}

/**
 * Interface for Containerized Agent Executor
 * Implements SOLID Interface Segregation - focused on container execution only
 */
export interface IContainerizedAgentExecutor {
  /**
   * Execute a task in a containerized agent
   * @param agentType - Type of agent (finance-analyst, supply-chain-specialist, etc.)
   * @param task - Task to execute
   * @param securityContext - Security context for validation
   * @returns Execution result
   */
  execute(
    agentType: string,
    task: string,
    securityContext: ISecurityContext,
  ): Promise<ContainerizedAgentResult>;

  /**
   * Get status of agent containers
   * @returns Array of container statuses
   */
  getContainerStatus(): Promise<AgentContainerStatus[]>;

  /**
   * Validate security context before container execution
   * @param securityContext - Context to validate
   * @returns Validation result
   */
  validateSecurityContext(
    securityContext: ISecurityContext,
  ): Promise<ISecurityValidationResult>;
}

/**
 * Default container configurations per agent type
 */
export const AGENT_CONTAINER_CONFIGS: Record<string, ContainerConfig> = {
  'finance-analyst': {
    image: 'localhost/neurecore/agent:latest',
    memoryLimit: '512Mi',
    cpuLimit: '500m',
    workspaceSizeLimit: '256Mi',
    networkEnabled: false,
  },
  'supply-chain-specialist': {
    image: 'localhost/neurecore/agent:latest',
    memoryLimit: '512Mi',
    cpuLimit: '500m',
    workspaceSizeLimit: '256Mi',
    networkEnabled: false,
  },
  'audit-compliance-officer': {
    image: 'localhost/neurecore/agent:latest',
    memoryLimit: '512Mi',
    cpuLimit: '500m',
    workspaceSizeLimit: '256Mi',
    networkEnabled: false,
  },
  default: {
    image: 'localhost/neurecore/agent:latest',
    memoryLimit: '512Mi',
    cpuLimit: '500m',
    workspaceSizeLimit: '256Mi',
    networkEnabled: false,
  },
};
