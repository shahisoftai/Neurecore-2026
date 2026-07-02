import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { StructuredToolRegistry } from '../../tools/structured-tool.registry';
import type {
  IToolGateway,
  ToolExecutionRequest,
  ToolGatewayDecision,
  ToolExecutionResult,
  ToolMenuItem,
} from '../interfaces/tool-gateway.interface';
import type { ToolPermissionLevel } from '@prisma/client';
import type { IStructuredTool } from '../../tools/interfaces/structured-tool.interface';
import type { ISecurityInterceptor } from '../../agents/security/interfaces/security.interfaces';

@Injectable()
export class ToolGatewayService implements IToolGateway {
  private readonly logger = new Logger(ToolGatewayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly toolRegistry: StructuredToolRegistry,
    private readonly securityInterceptor: ISecurityInterceptor,
  ) {}

  async validate(request: ToolExecutionRequest): Promise<ToolGatewayDecision> {
    const { hermesAgentId, toolName, tenantId, workspaceId } = request;

    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: hermesAgentId, tenantId },
      select: {
        id: true,
        type: true,
        tenantId: true,
        workspaceId: true,
        toolPermissions: { select: { toolName: true, permission: true } },
        isActive: true,
      },
    });

    if (!agent || !agent.isActive) {
      return {
        allowed: false,
        toolName,
        level: 'DENY',
        reason: 'Agent not found or inactive',
      };
    }

    if (agent.tenantId !== tenantId) {
      return {
        allowed: false,
        toolName,
        level: 'DENY',
        reason: 'Tenant isolation violation',
      };
    }

    const toolPermission = agent.toolPermissions.find(
      (p) => p.toolName === toolName,
    );
    if (toolPermission) {
      if (toolPermission.permission === 'DENY') {
        return {
          allowed: false,
          toolName,
          level: 'DENY',
          reason: 'Tool explicitly denied for this agent',
        };
      }
      if (toolPermission.permission === 'APPROVAL_REQUIRED') {
        return {
          allowed: false,
          toolName,
          level: 'APPROVAL_REQUIRED',
          reason: 'Tool requires approval',
        };
      }
    }

    const allToolNames = this.toolRegistry.listToolNames();
    if (!allToolNames.includes(toolName)) {
      return {
        allowed: false,
        toolName,
        level: 'DENY',
        reason: 'Tool not found in registry',
      };
    }

    const tool = this.toolRegistry.get(toolName);
    if (!tool) {
      return {
        allowed: false,
        toolName,
        level: 'DENY',
        reason: 'Tool not found',
      };
    }

    try {
      const securityResult = await this.securityInterceptor.validate(
        tool,
        request.toolInput,
        {
          tenantId,
          agentType: agent.type,
          userId: request.userId,
        },
      );

      if (!securityResult.allowed) {
        return {
          allowed: false,
          toolName,
          level: 'DENY',
          reason: securityResult.reason ?? 'Security validation failed',
        };
      }

      return {
        allowed: true,
        toolName,
        level: (toolPermission?.permission as ToolPermissionLevel) ?? 'ALLOW',
        sanitizedInput: securityResult.sanitizedInput,
      };
    } catch {
      return {
        allowed: true,
        toolName,
        level: (toolPermission?.permission as ToolPermissionLevel) ?? 'ALLOW',
      };
    }
  }

  async execute(request: ToolExecutionRequest): Promise<ToolExecutionResult> {
    const start = Date.now();

    try {
      const decision = await this.validate(request);
      if (!decision.allowed) {
        return {
          success: false,
          toolName: request.toolName,
          error: decision.reason ?? 'Tool execution denied',
          durationMs: Date.now() - start,
        };
      }

      const tool = this.toolRegistry.get(request.toolName);
      if (!tool) {
        return {
          success: false,
          toolName: request.toolName,
          error: 'Tool not found',
          durationMs: Date.now() - start,
        };
      }

      const enrichedInput = {
        ...(decision.sanitizedInput ?? request.toolInput),
        tenantId: request.tenantId,
        workspaceId: request.workspaceId,
        userId: request.userId,
        sessionId: request.sessionId,
        hermesAgentId: request.hermesAgentId,
      };

      const result = await this.toolRegistry.execute(tool.name, enrichedInput, {
        tenantId: request.tenantId,
        userId: request.userId,
        sessionId: request.sessionId,
      });

      return {
        success: true,
        toolName: request.toolName,
        output: result,
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        toolName: request.toolName,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  async getAllowedTools(
    hermesAgentId: string,
    tenantId: string,
  ): Promise<string[]> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: hermesAgentId, tenantId },
      select: {
        toolPermissions: { select: { toolName: true, permission: true } },
        isActive: true,
      },
    });

    if (!agent || !agent.isActive) return [];

    const denied = new Set(
      agent.toolPermissions
        .filter((p) => p.permission === 'DENY')
        .map((p) => p.toolName),
    );

    const allTools = this.toolRegistry.listToolNames();
    return allTools.filter((t) => !denied.has(t));
  }

  async buildToolMenu(
    hermesAgentId: string,
    tenantId: string,
  ): Promise<ToolMenuItem[]> {
    const allowed = await this.getAllowedTools(hermesAgentId, tenantId);
    const allDefs = this.toolRegistry.getToolDefinitions();

    return allDefs
      .filter((d) => allowed.includes(d.name))
      .map((d) => ({
        name: d.name,
        description: d.description,
        category: d.category as unknown as string,
        inputSchema: (d.parameters as unknown as Record<string, unknown>) ?? {},
        outputSchema: {},
        permission: 'ALLOW' as const,
      }));
  }
}
