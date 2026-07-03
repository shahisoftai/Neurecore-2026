import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { LLMFactory, type LLMProvider } from '../../models/services/llm-factory.service';
import { HermesRegistryService } from './hermes-registry.service';
import { HermesSessionService } from './hermes-session.service';
import { HermesContextService } from './hermes-context.service';
import { HermesMemoryService } from './hermes-memory.service';
import { HermesEventBusService } from './hermes-event-bus.service';
import { ToolGatewayService } from './tool-gateway.service';
import { EventsGateway } from '../../events/events.gateway';
import { TenantContextService } from '../../../common/context/tenant-context.service';
import {
  generateTraceId,
  calculateCostEstimate,
  sanitizeToolInput,
} from '../common/hermes.utils';
import {
  HERMES_DEFAULT_MAX_ITERATIONS,
  HERMES_DEFAULT_TEMPERATURE,
  HERMES_ERROR_CODES,
} from '../common/hermes.constants';
import type {
  HermesAgentStatus,
  HermesSession,
} from '@prisma/client';
import type { IHermesRuntime } from '../interfaces/hermes-runtime.interface';
import type {
  HermesExecutionRequest,
  HermesExecutionResult,
  HermesStreamEvent,
  HermesToolCallRecord,
} from '../interfaces/hermes-runtime.interface';
import type { LLMWithToolsResponse } from '../../models/interfaces/llm-client.interface';

@Injectable()
export class HermesRuntimeService implements IHermesRuntime {
  private readonly logger = new Logger(HermesRuntimeService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llmFactory: LLMFactory,
    private readonly registryService: HermesRegistryService,
    private readonly sessionService: HermesSessionService,
    private readonly contextService: HermesContextService,
    private readonly memoryService: HermesMemoryService,
    private readonly eventBus: HermesEventBusService,
    private readonly toolGateway: ToolGatewayService,
    private readonly eventsGateway: EventsGateway,
    private readonly tenantContext: TenantContextService,
  ) {}

  async execute(
    request: HermesExecutionRequest,
  ): Promise<HermesExecutionResult> {
    const traceId = generateTraceId();
    const startTime = Date.now();
    const maxIterations =
      request.maxIterations ?? HERMES_DEFAULT_MAX_ITERATIONS;

    this.logger.log(
      `[${traceId}] Executing Hermes task for agent ${request.hermesAgentId} in session ${request.sessionId}`,
    );

    const agent = await this.prisma.hermesAgent.findFirst({
      where: {
        id: request.hermesAgentId,
        tenantId: request.context.tenantId,
        isActive: true,
      },
    });

    if (!agent) {
      throw new NotFoundException({
        code: HERMES_ERROR_CODES.AGENT_NOT_FOUND,
        message: `Hermes agent ${request.hermesAgentId} not found or inactive`,
      });
    }

    await this.registryService.setStatus(
      agent.id,
      request.context.tenantId,
      'RUNNING',
    );

    await this.sessionService.updateStatus(
      request.sessionId,
      request.context.tenantId,
      'ACTIVE',
    );

    this.eventBus.emit({
      type: 'hermes:start',
      hermesAgentId: agent.id,
      sessionId: request.sessionId,
      tenantId: request.context.tenantId,
      payload: { task: request.task, traceId },
      timestamp: new Date(),
      traceId,
    });

    this.eventsGateway.emitToTenant(request.context.tenantId, 'hermes:start', {
      agentId: agent.id,
      sessionId: request.sessionId,
      task: request.task,
      traceId,
    });

    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;
    const toolCalls: HermesToolCallRecord[] = [];
    let finalContent = '';

    try {
      const execCtx = await this.contextService.buildExecutionContext(
        agent.id,
        request.context.tenantId,
        request.sessionId,
      );

      const conversationHistory =
        await this.sessionService.getConversationHistory(
          request.sessionId,
        );

      const messages: Array<{
        role: string;
        content: string;
      }> = [
        {
          role: 'system',
          content: execCtx.systemPrompt,
        },
      ];

      for (const msg of conversationHistory) {
        messages.push({
          role:
            msg.role === 'SYSTEM'
              ? 'user'
              : msg.role.toLowerCase(),
          content: msg.content,
        });
      }

      messages.push({
        role: 'user',
        content: request.task,
      });

      const toolDefinitions =
        await this.toolGateway.buildToolMenu(
          agent.id,
          request.context.tenantId,
        );

      const toolsForLLM = toolDefinitions
        .filter((t) =>
          (request.tools?.length ?? 0) > 0
            ? request.tools!.includes(t.name)
            : true,
        )
        .map((t) => ({
          type: 'function' as const,
          function: {
            name: t.name,
            description: t.description,
            parameters: {
              type: 'object' as const,
              properties: (t.conditions?.['parameters'] ?? {}) as Record<string, unknown>,
              required: [] as string[],
            },
          },
        }));

      for (let iteration = 0; iteration < maxIterations; iteration++) {
        const response: LLMWithToolsResponse =
          await this.llmFactory.invokeWithTools(
            messages,
            toolsForLLM,
            request.temperature ?? HERMES_DEFAULT_TEMPERATURE,
            4096,
          );

        totalPromptTokens += response.usage?.inputTokens ?? 0;
        totalCompletionTokens +=
          response.usage?.outputTokens ?? 0;

        if (response.content) {
          await this.sessionService.addMessage({
            sessionId: request.sessionId,
            role: 'HERMES',
            content: response.content,
            metadata: {
              iteration,
              tokens: response.usage,
              traceId,
            },
          });

          finalContent = response.content;
        }

        if (
          !response.toolCalls ||
          response.toolCalls.length === 0
        ) {
          break;
        }

        for (const tc of response.toolCalls) {
          const toolStartTime = Date.now();

          this.eventBus.emit({
            type: 'hermes:tool:call',
            hermesAgentId: agent.id,
            sessionId: request.sessionId,
            tenantId: request.context.tenantId,
            payload: {
              toolName: tc.name,
              toolInput: tc.arguments,
              iteration,
            },
            timestamp: new Date(),
            traceId,
          });

          const toolResult = await this.toolGateway.execute({
            hermesAgentId: agent.id,
            toolName: tc.name,
            toolInput: sanitizeToolInput(tc.arguments ?? {}),
            sessionId: request.sessionId,
            tenantId: request.context.tenantId,
            workspaceId: request.context.workspaceId,
            userId: request.context.userId,
          });

          const toolDuration = Date.now() - toolStartTime;

          const toolRecord: HermesToolCallRecord = {
            toolName: tc.name,
            toolInput: tc.arguments ?? {},
            toolResult: toolResult.output,
            error: toolResult.error,
            durationMs: toolDuration,
            costUsd: toolResult.costUsd,
            decision: toolResult.success ? 'ALLOWED' : 'DENIED',
          };

          toolCalls.push(toolRecord);

          await this.sessionService.addMessage({
            sessionId: request.sessionId,
            role: 'HERMES',
            content: `Tool "${tc.name}" result: ${toolResult.success ? JSON.stringify(toolResult.output) : toolResult.error}`,
            toolCalls: {
              name: tc.name,
              arguments: tc.arguments,
            },
            toolResults: {
              success: toolResult.success,
              output: toolResult.output,
              error: toolResult.error,
            },
          });

          if (toolResult.success && toolResult.output) {
            messages.push({
              role: 'assistant',
              content: `Tool "${tc.name}" executed: ${JSON.stringify(toolResult.output)}`,
            });
          }
        }
      }

      this.eventBus.emit({
        type: 'hermes:end',
        hermesAgentId: agent.id,
        sessionId: request.sessionId,
        tenantId: request.context.tenantId,
        payload: {
          success: true,
          content: finalContent,
          toolCalls: toolCalls.length,
          traceId,
        },
        timestamp: new Date(),
        traceId,
      });

      if (finalContent) {
        await this.memoryService.rememberEpisode(
          agent.id,
          request.context.tenantId,
          `Task executed: ${request.task}\nResult: ${finalContent.substring(0, 500)}`,
          { traceId, toolCalls: toolCalls.length },
        );
      }

      const totalTokens =
        totalPromptTokens + totalCompletionTokens;
      const costUsd = calculateCostEstimate(
        totalPromptTokens,
        totalCompletionTokens,
      );
      const durationMs = Date.now() - startTime;

      await this.auditExecution(agent.id, request, {
        success: true,
        content: finalContent,
        toolCalls,
        costUsd,
        durationMs,
        totalTokens,
        traceId,
      });

      return {
        success: true,
        sessionId: request.sessionId,
        content: finalContent,
        toolCalls,
        tokensUsed: {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          total: totalTokens,
        },
        costUsd,
        durationMs,
      };
    } catch (err) {
      const errorMsg = (err as Error).message;
      const durationMs = Date.now() - startTime;

      this.logger.error(
        `[${traceId}] Hermes execution failed: ${errorMsg}`,
      );

      this.eventBus.emit({
        type: 'hermes:error',
        hermesAgentId: agent.id,
        sessionId: request.sessionId,
        tenantId: request.context.tenantId,
        payload: {
          error: errorMsg,
          traceId,
          durationMs,
        },
        timestamp: new Date(),
        traceId,
      });

      await this.auditExecution(agent.id, request, {
        success: false,
        content: '',
        toolCalls,
        costUsd: 0,
        durationMs,
        totalTokens: totalPromptTokens + totalCompletionTokens,
        traceId,
        error: errorMsg,
      });

      return {
        success: false,
        sessionId: request.sessionId,
        content: '',
        toolCalls,
        tokensUsed: {
          prompt: totalPromptTokens,
          completion: totalCompletionTokens,
          total: totalPromptTokens + totalCompletionTokens,
        },
        costUsd: 0,
        durationMs,
        error: errorMsg,
        errorCode: HERMES_ERROR_CODES.EXECUTION_ERROR,
        retryable: true,
      };
    } finally {
      await this.registryService.setStatus(
        agent.id,
        request.context.tenantId,
        'IDLE',
      );

      await this.sessionService.updateStatus(
        request.sessionId,
        request.context.tenantId,
        'COMPLETED',
      );
    }
  }

  async *stream(
    request: HermesExecutionRequest,
  ): AsyncGenerator<HermesStreamEvent> {
    const traceId = generateTraceId();

    yield {
      type: 'hermes:start',
      data: {
        task: request.task,
        hermesAgentId: request.hermesAgentId,
        sessionId: request.sessionId,
        traceId,
      },
      timestamp: new Date(),
    };

    try {
      const result = await this.execute(request);

      if (result.success) {
        yield {
          type: 'hermes:token',
          data: { content: result.content },
          timestamp: new Date(),
        };

        for (const tc of result.toolCalls) {
          yield {
            type: 'hermes:tool:result',
            data: {
              toolName: tc.toolName,
              success: !tc.error,
              output: tc.toolResult,
              error: tc.error,
            },
            timestamp: new Date(),
          };
        }

        yield {
          type: 'hermes:end',
          data: {
            success: true,
            cost: result.costUsd,
            tokens: result.tokensUsed,
            traceId,
          },
          timestamp: new Date(),
        };
      } else {
        yield {
          type: 'hermes:error',
          data: {
            error: result.error,
            errorCode: result.errorCode,
            traceId,
          },
          timestamp: new Date(),
        };
      }
    } catch (err) {
      yield {
        type: 'hermes:error',
        data: {
          error: (err as Error).message,
          traceId,
        },
        timestamp: new Date(),
      };
    }
  }

  async suspend(
    agentId: string,
    tenantId: string,
  ): Promise<void> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException({
        code: HERMES_ERROR_CODES.AGENT_NOT_FOUND,
        message: `Hermes agent ${agentId} not found`,
      });
    }

    await this.registryService.setStatus(agentId, tenantId, 'SUSPENDED');

    this.logger.log(`Suspended Hermes agent ${agentId}`);
  }

  async resume(
    agentId: string,
    tenantId: string,
  ): Promise<void> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
    });

    if (!agent) {
      throw new NotFoundException({
        code: HERMES_ERROR_CODES.AGENT_NOT_FOUND,
        message: `Hermes agent ${agentId} not found`,
      });
    }

    await this.registryService.setStatus(agentId, tenantId, 'IDLE');

    this.logger.log(`Resumed Hermes agent ${agentId}`);
  }

  async getStatus(
    agentId: string,
    tenantId: string,
  ): Promise<HermesAgentStatus> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId },
      select: { status: true },
    });

    if (!agent) {
      throw new NotFoundException({
        code: HERMES_ERROR_CODES.AGENT_NOT_FOUND,
        message: `Hermes agent ${agentId} not found`,
      });
    }

    return agent.status;
  }

  async createSession(
    agentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ): Promise<HermesSession> {
    const agent = await this.prisma.hermesAgent.findFirst({
      where: { id: agentId, tenantId, isActive: true },
    });

    if (!agent) {
      throw new NotFoundException({
        code: HERMES_ERROR_CODES.AGENT_NOT_FOUND,
        message: `Hermes agent ${agentId} not found or inactive`,
      });
    }

    return this.sessionService.create({
      hermesAgentId: agentId,
      userId,
      tenantId,
      workspaceId,
    });
  }

  private async auditExecution(
    agentId: string,
    request: HermesExecutionRequest,
    result: {
      success: boolean;
      content: string;
      toolCalls: HermesToolCallRecord[];
      costUsd: number;
      durationMs: number;
      totalTokens: number;
      traceId: string;
      error?: string;
    },
  ): Promise<void> {
    try {
      await this.prisma.hermesAuditLog.create({
        data: {
          hermesAgentId: agentId,
          sessionId: request.sessionId,
          tenantId: request.context.tenantId,
          workspaceId: request.context.workspaceId,
          action: 'execute',
          request: {
            task: request.task,
            tools: request.tools,
            maxIterations: request.maxIterations,
          },
          response: {
            success: result.success,
            content: result.content
              ? result.content.substring(0, 1000)
              : '',
            toolCallsCount: result.toolCalls.length,
          },
          decision: result.success ? 'COMPLETED' : 'FAILED',
          reason: result.error ?? null,
          durationMs: result.durationMs,
          costUsd: result.costUsd,
          tokensUsed: result.totalTokens,
        },
      });
    } catch (err) {
      this.logger.warn(
        `Failed to write Hermes audit log: ${(err as Error).message}`,
      );
    }
  }
}
