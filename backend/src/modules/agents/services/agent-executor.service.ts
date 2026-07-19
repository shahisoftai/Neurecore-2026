import {
  Injectable,
  Logger,
  ForbiddenException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { EventsGateway } from '../../events/events.gateway';
import { AgentEvaluatorService } from './agent-evaluator.service';
import { ToolsService } from '../../tools/tools.service';
import { GovernanceRulesService } from '../../governance/services/governance-rules.service';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { HermesRuntimeService } from '../../hermes/services/hermes-runtime.service';
import { MetricsService } from '../../metrics/metrics.service';
import type {
  IAgentExecutor,
  ExecutionContext,
  StepResult,
  ExecutionResult,
} from '../interfaces/agent-executor.interface';
import { TaskStatus, AgentStatus } from '@prisma/client';

/**
 * AgentExecutorService
 *
 * Responsibility (SRP): Execute a single plan step or an entire task by
 * running steps in dependency order, persisting execution logs, emitting
 * real-time WebSocket events, and delegating evaluation to AgentEvaluatorService.
 *
 * SOLID:
 *  - SRP: executes only — delegates planning to planner, scoring to evaluator
 *  - DIP: depends on IAgentExecutor, ToolsService, EventsGateway abstractions
 *  - OCP: tool dispatch is open for extension via ToolsService registry
 */
@Injectable()
export class AgentExecutorService implements IAgentExecutor {
  private readonly logger = new Logger(AgentExecutorService.name);
  private readonly runningTasks = new Map<string, boolean>(); // taskId → cancelled

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventsGateway,
    private readonly evaluator: AgentEvaluatorService,
    private readonly tools: ToolsService,
    private readonly governance: GovernanceRulesService,
    private readonly featureFlag: FeatureFlagService,
    @Optional() private readonly hermesRuntime?: HermesRuntimeService,
    @Optional() private readonly metrics?: MetricsService,
  ) {}

  async execute(context: ExecutionContext): Promise<StepResult> {
    const start = Date.now();
    this.logger.debug(
      `Executing step ${context.step.id} for task ${context.taskId}`,
    );

    try {
      let output: unknown;

      // If step specifies a toolId, invoke it via ToolsService (DIP / OCP)
      if (context.step.toolId) {
        const toolResult = await this.tools.execute(
          context.step.toolId,
          context.step.input ?? {},
        );
        output = toolResult.success
          ? toolResult.data
          : { error: toolResult.error };
        if (!toolResult.success)
          throw new Error(toolResult.error ?? 'Tool execution failed');
      } else {
        output = { result: `Step "${context.step.description}" completed` };
      }

      const durationMs = Date.now() - start;
      await this.persistLog(context, output, durationMs, true);

      return { stepId: context.step.id, success: true, output, durationMs };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - start;
      await this.persistLog(context, null, durationMs, false, error);
      return { stepId: context.step.id, success: false, error, durationMs };
    }
  }

  async executeTask(
    taskId: string,
    agentId: string,
    tenantId: string,
  ): Promise<ExecutionResult> {
    const start = Date.now();
    this.runningTasks.set(taskId, false);

    // ─── Governance pre-check ───
    try {
      const task = await this.prisma.task.findUnique({
        where: { id: taskId },
        select: { title: true, priority: true },
      });
      const decision = await this.governance.evaluate(tenantId, {
        'task.id': taskId,
        'task.title': task?.title ?? '',
        'agent.id': agentId,
      });

      if (!decision.allowed) {
        // Update task to FAILED with reason
        await this.prisma.task.update({
          where: { id: taskId },
          data: {
            status: TaskStatus.FAILED,
            error: `Blocked by governance: ${decision.triggeredRules.join(', ')}`,
          },
        });
        this.events.emitAgentError(
          tenantId,
          agentId,
          taskId,
          `Governance blocked: ${decision.triggeredRules.join(', ')}`,
        );
        this.events.emitGovernanceTriggered(tenantId, agentId, decision);
        throw new ForbiddenException(
          `Task blocked by governance rules: ${decision.triggeredRules.join(', ')}`,
        );
      }

      if (decision.requiresApproval) {
        // Surface the decision via WebSocket; don't block (approval created separately by calling code)
        this.events.emitGovernanceTriggered(tenantId, agentId, decision);
        this.logger.warn(
          `[Governance] Task ${taskId} requires approval — triggered rules: ${decision.triggeredRules.join(', ')}`,
        );
      }
    } catch (govErr) {
      if (govErr instanceof ForbiddenException) throw govErr;
      // Governance failures are non-fatal to avoid blocking execution on infrastructure issues
      this.logger.warn(
        `[Governance] Pre-check failed for task ${taskId}: ${String(govErr)}`,
      );
    }
    // ─── End governance pre-check ───

    // ─── Hermes-only execution path (Phase H, 2026-07-19) ───────────────────
    // Phase H of the chat-unification refactor: the legacy OfficialAgentGraph
    // direct path has been removed entirely. All agent execution flows through
    // the Hermes runtime. The `HERMES_ENABLED` feature flag is no longer
    // honored — every tenant uses Hermes by definition.
    //
    // Per-tenant emergency kill-switch is via `DISABLE_AI_ACTIONS` (already
    // exists; checked elsewhere in the executor flow).

    if (!this.hermesRuntime) {
      this.metrics?.hermesExecutionPathTotal.inc({
        hermes_enabled: 'true',
        executor: 'hermes_runtime',
        result: 'error',
      });
      this.logger.error(
        `[AgentExecutor] HermesRuntimeService not injected — configuration error`,
      );
      throw new Error(
        'HermesRuntimeService not available. Check HermesModule imports.',
      );
    }

    try {
      const result = await this.executeTaskViaHermes(taskId, agentId, tenantId, start);
      this.metrics?.hermesExecutionPathTotal.inc({
        hermes_enabled: 'true',
        executor: 'hermes_runtime',
        result: 'success',
      });
      return result;
    } catch (err) {
      this.metrics?.hermesExecutionPathTotal.inc({
        hermes_enabled: 'true',
        executor: 'hermes_runtime',
        result: 'error',
      });
      throw err;
    }
    // ─── End Hermes-only execution path ────────────────────────────────────

    // Unreachable code retained as TypeScript noImplicitReturns guard.
    throw new Error(
      '[AgentExecutor] Unreachable: legacy OfficialAgentGraph path was retired in Phase H (2026-07-19).',
    );
  }

  async cancelTask(taskId: string): Promise<void> {
    if (this.runningTasks.has(taskId)) {
      this.runningTasks.set(taskId, true);
    }
    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.CANCELLED },
    });
  }

  // ───────────────────────────────────────────────────────────
  // Hermes execution path (feature-flagged)
  // ───────────────────────────────────────────────────────────

  private async executeTaskViaHermes(
    taskId: string,
    agentId: string,
    tenantId: string,
    start: number,
  ): Promise<ExecutionResult> {
    this.logger.log(`[Hermes] Executing task ${taskId} via Hermes runtime`);

    await this.prisma.task.update({
      where: { id: taskId },
      data: { status: TaskStatus.RUNNING, startedAt: new Date() },
    });

    await this.prisma.agent.update({
      where: { id: agentId },
      data: { status: AgentStatus.RUNNING },
    });

    this.events.emitToTenant(tenantId, 'task:started', { taskId, agentId });

    try {
      const agent = await this.prisma.agent.findUnique({
        where: { id: agentId },
        select: { hermesAgentId: true, name: true, model: true },
      });

      const autoLink = this.featureFlag.isEnabled('HERMES_AUTO_LINK');

      const result = await this.hermesRuntime!.execute({
        sessionId: taskId,
        hermesAgentId: agent?.hermesAgentId ?? agentId,
        task: `Execute task ${taskId}`,
        context: {
          tenantId,
          agentId,
          threadId: taskId,
        },
        autoLink,
      });

      const totalDurationMs = Date.now() - start;

      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: result.success ? TaskStatus.COMPLETED : TaskStatus.FAILED,
          completedAt: new Date(),
          output: JSON.stringify({
            steps: result.steps,
            hermesResult: result.output,
          }),
          error: result.error ?? null,
        },
      });

      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: AgentStatus.IDLE },
      });

      const event = result.success ? 'task:completed' : 'task:failed';
      this.events.emitToTenant(tenantId, event, {
        taskId,
        agentId,
        success: result.success,
        error: result.error ?? null,
      });

      return {
        taskId,
        agentId,
        success: result.success,
        steps: result.steps,
        finalOutput: result.output,
        error: result.error,
        totalDurationMs,
        totalTokensUsed: result.tokensUsed ?? 0,
        totalCostUsd: result.costUsd ?? 0,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(`[Hermes] Task ${taskId} failed`, error);
      const totalDurationMs = Date.now() - start;

      await this.prisma.task.update({
        where: { id: taskId },
        data: {
          status: TaskStatus.FAILED,
          completedAt: new Date(),
          error: errorMessage,
        },
      });

      await this.prisma.agent.update({
        where: { id: agentId },
        data: { status: AgentStatus.IDLE },
      });

      this.events.emitAgentError(tenantId, agentId, taskId, errorMessage);

      return {
        taskId,
        agentId,
        success: false,
        steps: [],
        error: errorMessage,
        totalDurationMs,
        totalTokensUsed: 0,
        totalCostUsd: 0,
      };
    }
  }

  // ───────────────────────────────────────────────────────────
  // Private helpers
  // ───────────────────────────────────────────────────────────

  private async persistLog(
    ctx: ExecutionContext,
    output: unknown,
    durationMs: number,
    success: boolean,
    error?: string,
  ): Promise<void> {
    await this.prisma.executionLog.create({
      data: {
        agentId: ctx.agentId,
        taskId: ctx.taskId,
        step: ctx.step.id,
        input: (ctx.step.input ?? {}) as never,
        output: (output as never) ?? undefined,
        durationMs,
        success,
        error: error ?? null,
      },
    });
  }
}
