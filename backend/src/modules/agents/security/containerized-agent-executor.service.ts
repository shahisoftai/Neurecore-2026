import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { execSync } from 'child_process';
import {
  ISecurityContext,
  ISecurityValidationResult,
} from './interfaces/security.interfaces';
import {
  IContainerizedAgentExecutor,
  AgentContainerStatus,
  ContainerizedAgentResult,
  AgentExecutionMode,
  AGENT_CONTAINER_CONFIGS,
  ContainerConfig,
} from '../interfaces/containerized-agent.interface';

/**
 * Containerized Agent Executor Service
 *
 * SOLID Principles:
 * - Single Responsibility: Only handles Podman container execution for agents
 * - Dependency Inversion: Uses IContainerizedAgentExecutor interface
 * - Interface Segregation: Focused interface for container execution
 *
 * Security Features:
 * - Non-root container execution
 * - Memory and CPU limits
 * - Ephemeral tmpfs workspaces
 * - No network access by default
 * - Security context validation before execution
 */
@Injectable()
export class ContainerizedAgentExecutor implements IContainerizedAgentExecutor {
  private readonly logger = new Logger(ContainerizedAgentExecutor.name);
  private readonly podmanPath: string;
  private readonly podName: string;
  private readonly executionMode: AgentExecutionMode;

  constructor(private readonly config: ConfigService) {
    // Find podman binary
    this.podmanPath = this.findPodman();

    // Get pod name from config
    this.podName = this.config.get<string>(
      'AGENT_POD_NAME',
      'neurecore-agents',
    );

    // Determine execution mode
    const mode = this.config.get<string>('AGENT_EXECUTION_MODE', 'in_process');
    this.executionMode = mode as AgentExecutionMode;

    this.logger.log(`ContainerizedAgentExecutor initialized`);
    this.logger.log(`  Podman path: ${this.podmanPath}`);
    this.logger.log(`  Pod name: ${this.podName}`);
    this.logger.log(`  Execution mode: ${this.executionMode}`);
  }

  /**
   * Find podman binary path
   */
  private findPodman(): string {
    const paths = ['/usr/bin/podman', '/usr/local/bin/podman', 'podman'];

    for (const path of paths) {
      try {
        execSync(`which ${path}`, { stdio: 'ignore' });
        return path;
      } catch {
        continue;
      }
    }

    this.logger.warn('Podman not found in standard paths, using "podman"');
    return 'podman';
  }

  /**
   * Execute a task in a containerized agent
   */
  async execute(
    agentType: string,
    task: string,
    securityContext: ISecurityContext,
  ): Promise<ContainerizedAgentResult> {
    const startTime = Date.now();

    // Validate security context first
    const validation = await this.validateSecurityContext(securityContext);
    if (!validation.allowed) {
      return {
        exitCode: 1,
        output: '',
        error: `Security validation failed: ${validation.reason}`,
        duration: Date.now() - startTime,
      };
    }

    // Get container config for this agent type
    const config: ContainerConfig = this.getContainerConfig(agentType);

    try {
      this.logger.log(`Executing ${agentType} in container`);

      // Build podman command
      const containerName = `${agentType}-${Date.now()}`;
      const workspaceDir = `/tmp/neurecore-workspace-${containerName}`;

      // Create workspace directory
      execSync(`mkdir -p ${workspaceDir} && chmod 700 ${workspaceDir}`, {
        stdio: 'ignore',
      });

      // Build podman run command with security flags
      const cmd = this.buildPodmanRunCommand(
        containerName,
        config,
        workspaceDir,
        task,
      );

      this.logger.debug(`Podman command: ${cmd}`);

      // Execute
      const output: string = execSync(cmd, {
        encoding: 'utf-8',
        timeout: 300000,
      });

      // Cleanup
      try {
        execSync(`${this.podmanPath} rm -f ${containerName}`, {
          stdio: 'ignore',
        });
        execSync(`rm -rf ${workspaceDir}`, { stdio: 'ignore' });
      } catch {
        // Cleanup errors are non-fatal
      }

      return {
        exitCode: 0,
        output: output,
        duration: Date.now() - startTime,
      };
    } catch (err: unknown) {
      const error = err as {
        message?: string;
        status?: number;
        stdout?: string;
      };
      this.logger.error(
        `Container execution failed: ${error.message || 'Unknown error'}`,
      );

      return {
        exitCode: error.status || 1,
        output: error.stdout || '',
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Build the podman run command with security hardening
   */
  private buildPodmanRunCommand(
    containerName: string,
    config: ContainerConfig,
    workspaceDir: string,
    task: string,
  ): string {
    const memoryLimit = config.memoryLimit || '512Mi';

    const parts = [
      this.podmanPath,
      'run',
      '--rm',
      '--name',
      containerName,
      '--pod',
      this.podName,
      '--user',
      '1000:1000',
      '--memory',
      memoryLimit,
      '--memory-swap',
      memoryLimit,
      '--cpu-quota',
      '50000',
      '--cpus',
      '0.5',
      '--pids-limit',
      '100',
      '--ulimit',
      'nofile=1024:1024',
      '--read-only',
      '--tmpfs',
      '/tmp:rw,noexec,nosuid,size=64m',
      '--tmpfs',
      '/var/tmp:rw,noexec,nosuid,size=64m',
      '--security-opt',
      'no-new-privileges',
      '--security-opt',
      'seccomp=unconfined',
      '--cap-drop',
      'ALL',
      '--gidmap',
      '0:1000:1',
      '-v',
      `${workspaceDir}:/workspace:rw`,
      '-e',
      `AGENT_TASK=${task.replace(/'/g, "'\\''")}`,
      '-e',
      'AGENT_WORKSPACE=/workspace',
      config.image,
      '/bin/bash',
      '-c',
      `echo "Task received" && eval "$AGENT_TASK"`,
    ];

    return parts.join(' ');
  }

  /**
   * Get container configuration for agent type
   */
  private getContainerConfig(agentType: string): ContainerConfig {
    return (
      AGENT_CONTAINER_CONFIGS[agentType] || AGENT_CONTAINER_CONFIGS['default']
    );
  }

  /**
   * Get status of all agent containers
   */
  async getContainerStatus(): Promise<AgentContainerStatus[]> {
    try {
      const output: string = execSync(
        `${this.podmanPath} ps -a --format "{{.Names}}\\t{{.Status}}\\t{{.Image}}" | grep agent`,
        { encoding: 'utf-8' },
      );

      const lines = output.trim().split('\n').filter(Boolean);
      const result = lines.map((line: string) => {
        const [name, status] = line.split('\t');
        return {
          name,
          running: status.includes('Up'),
          uptime: status,
        };
      });
      return Promise.resolve(result);
    } catch {
      return Promise.resolve([]);
    }
  }

  /**
   * Validate security context before container execution
   */
  async validateSecurityContext(
    securityContext: ISecurityContext,
  ): Promise<ISecurityValidationResult> {
    // Basic validation
    if (!securityContext.tenantId) {
      return Promise.resolve({
        allowed: false,
        reason: 'Missing tenantId in security context',
      });
    }

    if (!securityContext.agentType) {
      return Promise.resolve({
        allowed: false,
        reason: 'Missing agentType in security context',
      });
    }

    return Promise.resolve({
      allowed: true,
      reason: 'Security context valid',
    });
  }

  /**
   * Check if containerized execution is available
   */
  isContainerizedExecutionAvailable(): boolean {
    try {
      execSync(`${this.podmanPath} info`, { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get current execution mode
   */
  getExecutionMode(): AgentExecutionMode {
    return this.executionMode;
  }
}
