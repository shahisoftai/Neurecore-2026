import { Injectable, Logger } from '@nestjs/common';
import { ToolPermissionLevel } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { StructuredToolRegistry } from '../../tools/structured-tool.registry';
import { GovernanceRulesService } from '../../governance/services/governance-rules.service';
import { HermesEventBusService } from './hermes-event-bus.service';
import {
  getHermesToolSet,
  getAllowedToolNames,
} from '../../tools/built-in/hermes-tools';
import type { IToolGateway } from '../interfaces/tool-gateway.interface';
import type {
  ToolExecutionRequest,
  ToolGatewayDecision,
  ToolExecutionResult,
  ToolDefinition,
} from '../interfaces/tool-gateway.interface';

@Injectable()
export class ToolGatewayService implements IToolGateway {
  private readonly logger = new Logger(ToolGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: StructuredToolRegistry,
    private readonly governanceRules: GovernanceRulesService,
    private readonly eventBus: HermesEventBusService,
  ) {}

  async validate(
    request: ToolExecutionRequest,
  ): Promise<ToolGatewayDecision> {
    const validateAgent = await this.prisma.hermesAgent.findFirst({
      where: {
        id: request.hermesAgentId,
        tenantId: request.tenantId,
      },
      include: { toolPermissions: true },
    });

    if (!validateAgent) {
      return {
        allowed: false,
        toolName: request.toolName,
        decision: ToolPermissionLevel.DENY,
        reason: `Hermes agent ${request.hermesAgentId} not found or inactive`,
      };
    }

    const explicitPermission = validateAgent.toolPermissions.find(
      (tp) => tp.toolName === request.toolName,
    );

    const defaultToolSet = getHermesToolSet(validateAgent.type);
    const defaultDescriptor = defaultToolSet.find(
      (t) => t.name === request.toolName,
    );

    const effectivePermission =
      explicitPermission?.permission ??
      defaultDescriptor?.permission ??
      ToolPermissionLevel.DENY;

    if (effectivePermission === ToolPermissionLevel.DENY) {
      this.eventBus.emit({
        type: 'hermes:tool:denied',
        hermesAgentId: request.hermesAgentId,
        sessionId: request.sessionId,
        tenantId: request.tenantId,
        payload: {
          toolName: request.toolName,
          reason: 'Tool denied by permission level',
        },
        timestamp: new Date(),
        traceId: '',
      });

      return {
        allowed: false,
        toolName: request.toolName,
        decision: ToolPermissionLevel.DENY,
        reason: `Tool "${request.toolName}" is explicitly denied`,
      };
    }

    try {
      const governance = await this.governanceRules.evaluate(
        request.tenantId,
        {
          action: 'tool_execution',
          toolName: request.toolName,
          agentId: request.hermesAgentId,
          agentType: validateAgent.type,
          sessionId: request.sessionId,
          userId: request.userId,
          ...request.toolInput,
        },
      );

      if (!governance.allowed) {
        return {
          allowed: false,
          toolName: request.toolName,
          decision: ToolPermissionLevel.DENY,
          reason:
            governance.triggeredRules.join(', ') ||
            'Blocked by governance',
          governanceRule: governance.triggeredRules[0],
        };
      }

      if (governance.requiresApproval) {
        return {
          allowed: false,
          toolName: request.toolName,
          decision: ToolPermissionLevel.APPROVAL_REQUIRED,
          reason: 'Requires approval per governance rules',
          governanceRule: governance.triggeredRules[0],
        };
      }
    } catch (err) {
      this.logger.warn(
        `Governance evaluation failed for tool "${request.toolName}": ${(err as Error).message}. Proceeding without governance check.`,
      );
    }

    if (
      effectivePermission === ToolPermissionLevel.APPROVAL_REQUIRED
    ) {
      this.eventBus.emit({
        type: 'hermes:approval:requested',
        hermesAgentId: request.hermesAgentId,
        sessionId: request.sessionId,
        tenantId: request.tenantId,
        payload: {
          toolName: request.toolName,
          toolInput: request.toolInput,
          conditions: explicitPermission?.conditions ?? defaultDescriptor?.conditions,
        },
        timestamp: new Date(),
        traceId: '',
      });

      return {
        allowed: false,
        toolName: request.toolName,
        decision: ToolPermissionLevel.APPROVAL_REQUIRED,
        reason:
          'Tool requires human approval before execution',
        requiredApprovalId: undefined,
      };
    }

    return {
      allowed: true,
      toolName: request.toolName,
      decision: effectivePermission,
    };
  }

  async execute(
    request: ToolExecutionRequest,
  ): Promise<ToolExecutionResult> {
    const startTime = Date.now();
    const decision = await this.validate(request);

    if (!decision.allowed) {
      return {
        success: false,
        toolName: request.toolName,
        error: decision.reason ?? 'Tool execution denied',
        errorCode: 'TOOL_DENIED',
        durationMs: Date.now() - startTime,
        costUsd: 0,
      };
    }

    this.eventBus.emit({
      type: 'hermes:tool:call',
      hermesAgentId: request.hermesAgentId,
      sessionId: request.sessionId,
      tenantId: request.tenantId,
      payload: {
        toolName: request.toolName,
        toolInput: request.toolInput,
      },
      timestamp: new Date(),
      traceId: '',
    });

    try {
      const result = await this.toolRegistry.execute(
        request.toolName,
        request.toolInput,
        {
          tenantId: request.tenantId,
          userId: request.userId,
          sessionId: request.sessionId,
        } as any,
      );

      const durationMs = Date.now() - startTime;

      this.eventBus.emit({
        type: 'hermes:tool:result',
        hermesAgentId: request.hermesAgentId,
        sessionId: request.sessionId,
        tenantId: request.tenantId,
        payload: {
          toolName: request.toolName,
          success: true,
          durationMs,
        },
        timestamp: new Date(),
        traceId: '',
      });

      return {
        success: true,
        toolName: request.toolName,
        output: result as Record<string, unknown>,
        durationMs,
        costUsd: 0,
      };
    } catch (err) {
      const durationMs = Date.now() - startTime;
      this.logger.error(
        `Tool execution failed for "${request.toolName}": ${(err as Error).message}`,
      );

      return {
        success: false,
        toolName: request.toolName,
        error: (err as Error).message,
        errorCode: 'TOOL_EXECUTION_ERROR',
        durationMs,
        costUsd: 0,
      };
    }
  }

  async getAllowedTools(
    hermesAgentId: string,
    tenantId: string,
  ): Promise<string[]> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: hermesAgentId, tenantId },
      include: { toolPermissions: true },
    });

    if (!agent) return [];

    const customDenied = agent.toolPermissions
      .filter((tp) => tp.permission === ToolPermissionLevel.DENY)
      .map((tp) => tp.toolName);

    const defaultAllowed = getAllowedToolNames(agent.type);

    return defaultAllowed.filter(
      (tool) => !customDenied.includes(tool),
    );
  }

  async buildToolMenu(
    hermesAgentId: string,
    tenantId: string,
  ): Promise<ToolDefinition[]> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: hermesAgentId, tenantId },
      include: { toolPermissions: true },
    });

    if (!agent) return [];

    const defaultTools = getHermesToolSet(agent.type);

    const menu: ToolDefinition[] = [];

    for (const dt of defaultTools) {
      const override = agent.toolPermissions.find(
        (tp) => tp.toolName === dt.name,
      );

      menu.push({
        name: dt.name,
        description: dt.description,
        permission: override?.permission ?? dt.permission,
        conditions: (override?.conditions as any) ?? (dt.conditions as any),
      });
    }

    for (const tp of agent.toolPermissions) {
      if (!defaultTools.some((dt) => dt.name === tp.toolName)) {
        menu.push({
          name: tp.toolName,
          description: `Custom permission: ${tp.permission}`,
          permission: tp.permission,
          conditions: tp.conditions as any,
        });
      }
    }

    return menu.filter(
      (t) => t.permission !== ToolPermissionLevel.DENY,
    );
  }
}
