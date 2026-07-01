import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { HttpRequestTool } from './built-in/http-request.tool';
import { CalculatorTool } from './built-in/calculator.tool';
import type { ITool, ToolInput, ToolOutput } from './interfaces/tool.interface';

/**
 * ToolsService
 *
 * Responsibility (SRP): Registry and dispatch for all tools.
 * New tools registered without modifying dispatch logic (OCP).
 */
@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);
  private readonly registry = new Map<string, ITool>();

  constructor(
    private readonly prisma: PrismaService,
    httpTool: HttpRequestTool,
    calcTool: CalculatorTool,
  ) {
    if (httpTool) this.register(httpTool);
    else
      this.logger.warn(
        'HttpRequestTool provider was undefined during ToolsService construction',
      );
    if (calcTool) this.register(calcTool);
    else
      this.logger.warn(
        'CalculatorTool provider was undefined during ToolsService construction',
      );
  }

  register(tool: ITool): void {
    if (!tool || typeof tool.name !== 'string') {
      this.logger.warn(
        'Attempted to register invalid or undefined tool, skipping',
      );
      return;
    }

    this.registry.set(tool.name, tool);
    this.logger.log(`Registered tool: ${tool.name}`);
  }

  async execute(
    toolName: string,
    input: ToolInput,
    context?: { tenantId?: string },
  ): Promise<ToolOutput> {
    const tool = this.registry.get(toolName);
    if (!tool) throw new NotFoundException(`Tool "${toolName}" not found`);
    return tool.execute(input);
  }

  /**
   * Phase 0 (FIX-001): tenant-ownership check helper. Returns the integration
   * if it exists AND either is built-in OR belongs to the caller's tenant.
   * Throws NotFoundException if not found; throws ForbiddenException if
   * cross-tenant.
   */
  async assertIntegrationAccess(
    integrationId: string,
    tenantId: string,
  ): Promise<{ id: string; isBuiltIn: boolean; tenantId: string | null }> {
    const integration = await this.prisma.toolIntegration.findUnique({
      where: { id: integrationId },
      select: { id: true, tenantId: true, isBuiltIn: true },
    });
    if (!integration) {
      throw new NotFoundException(
        `Tool integration ${integrationId} not found`,
      );
    }
    if (!integration.isBuiltIn && integration.tenantId !== tenantId) {
      this.logger.warn(
        `Cross-tenant tool access attempt: tenantId=${tenantId} attempted toolIntegrationId=${integrationId} (owner=${integration.tenantId})`,
      );
      throw new ForbiddenException('Cross-tenant tool access denied');
    }
    return integration;
  }

  list(): Array<{ name: string; description: string; category: string }> {
    return Array.from(this.registry.values()).map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
    }));
  }

  async findIntegrations(tenantId: string) {
    return this.prisma.toolIntegration.findMany({
      where: { OR: [{ tenantId }, { isBuiltIn: true }], isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Register a new ToolIntegration (custom/external tool) for a tenant.
   * OCP: persists metadata; actual execution left to registered ITool implementations.
   */
  async registerIntegration(
    tenantId: string,
    input: {
      name: string;
      description?: string;
      type?: string;
      config?: Record<string, unknown>;
      isBuiltIn?: boolean;
    },
  ) {
    return this.prisma.toolIntegration.create({
      data: {
        name: input.name,
        description: input.description,
        category: (input.type as 'CUSTOM' | undefined) ?? 'CUSTOM',
        config: (input.config ?? {}) as never,
        isBuiltIn: input.isBuiltIn ?? false,
        isActive: true,
        tenantId,
      },
    });
  }

  /**
   * Execute a tool by its ToolIntegration id and persist an execution log.
   * Writes ExecutionLog.toolId so observability can aggregate cost per tool.
   */
  async executeById(
    integrationId: string,
    input: ToolInput,
    context?: { agentId?: string; taskId?: string; tenantId?: string },
  ): Promise<ToolOutput> {
    const integration = await this.prisma.toolIntegration.findUnique({
      where: { id: integrationId },
    });
    if (!integration)
      throw new NotFoundException(
        `Tool integration ${integrationId} not found`,
      );

    const start = Date.now();
    let result: ToolOutput;
    try {
      result = await this.execute(integration.name, input);
    } catch (err) {
      result = {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    const durationMs = Date.now() - start;

    // Persist execution log so observability can aggregate cost/usage per tool
    if (context?.agentId) {
      await this.prisma.executionLog.create({
        data: {
          agentId: context.agentId,
          taskId: context.taskId,
          step: `tool:${integration.name}`,
          input: input as never,
          output: (result.data ?? result.error ?? null) as never,
          durationMs,
          success: result.success,
          error: result.error ?? null,
          toolId: integrationId,
        },
      });
    }

    return result;
  }

  /** Get execution history for a tool integration */
  async getToolStatus(integrationId: string): Promise<{
    integrationId: string;
    totalExecutions: number;
    successRate: number;
    avgDurationMs: number;
    lastExecutedAt: Date | null;
  }> {
    const integration = await this.prisma.toolIntegration.findUnique({
      where: { id: integrationId },
    });
    if (!integration)
      throw new NotFoundException(
        `Tool integration ${integrationId} not found`,
      );

    const logs = await this.prisma.executionLog.findMany({
      where: { toolId: integrationId },
      select: { success: true, durationMs: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const total = logs.length;
    const successes = logs.filter((l) => l.success).length;
    const avgMs =
      total > 0 ? logs.reduce((s, l) => s + (l.durationMs ?? 0), 0) / total : 0;

    return {
      integrationId,
      totalExecutions: total,
      successRate: total > 0 ? successes / total : 0,
      avgDurationMs: Math.round(avgMs),
      lastExecutedAt: logs[0]?.createdAt ?? null,
    };
  }
}
