import {
  Injectable,
  Logger,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import type {
  HermesExecutionRequest,
  HermesExecutionResult,
  HermesStreamEvent,
  ToolCallResult,
  HermesMessageResult,
  IHermesRuntime,
} from '../interfaces/hermes-runtime.interface';
import type { HermesSessionDescriptor } from '../interfaces/hermes-session.interface';
import { HermesRegistryService } from './hermes-registry.service';
import { HermesSessionService } from './hermes-session.service';
import { HermesMemoryService } from './hermes-memory.service';
import { HermesContextService } from './hermes-context.service';
import { ToolGatewayService } from './tool-gateway.service';
import { LLMFactory } from '../../models/services/llm-factory.service';
import { DEFAULT_MAX_ITERATIONS } from '../common/hermes.types';

@Injectable()
export class HermesRuntimeService implements IHermesRuntime {
  private readonly logger = new Logger(HermesRuntimeService.name);

  constructor(
    private readonly registry: HermesRegistryService,
    private readonly sessions: HermesSessionService,
    private readonly memory: HermesMemoryService,
    private readonly contextService: HermesContextService,
    private readonly toolGateway: ToolGatewayService,
    private readonly llmFactory: LLMFactory,
  ) {}

  async execute(
    request: HermesExecutionRequest,
  ): Promise<HermesExecutionResult> {
    const start = Date.now();
    const traceId = randomUUID();
    const toolCallResults: ToolCallResult[] = [];
    let totalTokens = 0;
    const totalCost = 0;

    try {
      const ctx = await this.contextService.build(request);

      if (ctx.governanceContext.requiresApproval) {
        return {
          sessionId: request.sessionId,
          hermesAgentId: request.hermesAgentId,
          success: false,
          error: `GOVERNANCE_APPROVAL_REQUIRED: ${ctx.governanceContext.blockedRules.join(', ')}`,
          toolCalls: [],
          tokensUsed: 0,
          costUsd: 0,
          durationMs: Date.now() - start,
          messages: [],
        };
      }

      await this.sessions.addMessage(
        request.sessionId,
        {
          role: 'USER',
          content: request.task,
        },
        request.context.tenantId,
      );

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: ctx.systemPrompt },
        ...(ctx.memoryContext
          ? [{ role: 'system', content: `Context:\n${ctx.memoryContext}` }]
          : []),
        { role: 'user', content: request.task },
      ];

      const toolDefs = ctx.allowedTools
        .map((name) => {
          const tool = this.toolGateway['toolRegistry']?.get?.(name);
          if (!tool) return null;
          return tool.toFunctionCall();
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      let iterations = 0;
      let finalContent = '';
      const maxIterations = request.maxIterations ?? DEFAULT_MAX_ITERATIONS;

      while (iterations < maxIterations) {
        iterations++;

        const llmResponse = await this.llmFactory.invokeWithTools(
          messages,
          toolDefs as Parameters<typeof this.llmFactory.invokeWithTools>[1],
          0.3,
          2048,
        );

        totalTokens += llmResponse.usage?.totalTokens ?? 0;
        finalContent = llmResponse.content ?? '';

        if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
          break;
        }

        for (const tc of llmResponse.toolCalls) {
          const callId = randomUUID();

          const toolResult = await this.executeToolCall({
            tool: tc.name,
            input: tc.arguments,
            hermesAgentId: request.hermesAgentId,
            sessionId: request.sessionId,
            tenantId: request.context.tenantId,
            workspaceId: request.context.workspaceId,
            userId: request.context.userId,
          });

          toolCallResults.push(toolResult);

          messages.push({
            role: 'assistant',
            content: '',
          });
          messages.push({
            role: 'tool',
            content: JSON.stringify(
              toolResult.output ?? { error: toolResult.error },
            ),
          });

          if (toolResult.error && !toolResult.allowed) {
            this.logger.warn(
              `[HermesRuntime] Tool ${tc.name} denied for agent ${request.hermesAgentId}`,
            );
          }
        }
      }

      await this.sessions.addMessage(
        request.sessionId,
        {
          role: 'HERMES',
          content: finalContent,
          toolCalls: toolCallResults.map((r) => ({
            tool: r.tool,
            input: r.input,
            callId: randomUUID(),
          })),
          toolResults: toolCallResults.map((r) => ({
            tool: r.tool,
            output: r.output,
            error: r.error,
          })),
        },
        request.context.tenantId,
      );

      if (finalContent && toolCallResults.length > 0) {
        await this.memory.store(
          {
            hermesAgentId: request.hermesAgentId,
            type: 'EPISODIC',
            content: `Task: ${request.task}\nResult: ${finalContent}\nTools used: ${toolCallResults.map((r) => r.tool).join(', ')}`,
            summary: finalContent.slice(0, 100),
            importance: 0.6,
            source: 'task_execution',
          },
          request.context.tenantId,
        );
      }

      await this.registry.recordUsage(
        request.hermesAgentId,
        'execute',
        totalCost,
        Date.now() - start,
      );

      return {
        sessionId: request.sessionId,
        hermesAgentId: request.hermesAgentId,
        success: true,
        output: finalContent,
        toolCalls: toolCallResults,
        tokensUsed: totalTokens,
        costUsd: totalCost,
        durationMs: Date.now() - start,
        messages: [
          { role: 'HERMES', content: finalContent, toolCalls: toolCallResults },
        ],
      };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`[HermesRuntime] Execution failed: ${errorMessage}`);

      await this.sessions.addMessage(
        request.sessionId,
        {
          role: 'SYSTEM',
          content: '',
          error: errorMessage,
        },
        request.context.tenantId,
      );

      return {
        sessionId: request.sessionId,
        hermesAgentId: request.hermesAgentId,
        success: false,
        error: errorMessage,
        toolCalls: toolCallResults,
        tokensUsed: totalTokens,
        costUsd: totalCost,
        durationMs: Date.now() - start,
        messages: [],
      };
    }
  }

  async *stream(
    request: HermesExecutionRequest,
  ): AsyncGenerator<HermesStreamEvent> {
    const start = Date.now();
    const traceId = randomUUID();

    try {
      const ctx = await this.contextService.build(request);

      if (ctx.governanceContext.requiresApproval) {
        yield {
          type: 'error',
          data: {
            code: 'GOVERNANCE_APPROVAL_REQUIRED',
            rules: ctx.governanceContext.blockedRules,
          },
          timestamp: new Date(),
        };
        return;
      }

      const messages: Array<{ role: string; content: string }> = [
        { role: 'system', content: ctx.systemPrompt },
        ...(ctx.memoryContext
          ? [{ role: 'system', content: `Context:\n${ctx.memoryContext}` }]
          : []),
        { role: 'user', content: request.task },
      ];

      const toolDefs = ctx.allowedTools
        .map((name) => {
          const tool = this.toolGateway['toolRegistry']?.get?.(name);
          return tool?.toFunctionCall() ?? null;
        })
        .filter((t): t is NonNullable<typeof t> => t !== null);

      yield {
        type: 'chunk',
        data: { content: '' },
        timestamp: new Date(),
      };

      let accumulated = '';
      let iterations = 0;
      const maxIterations = request.maxIterations ?? DEFAULT_MAX_ITERATIONS;

      while (iterations < maxIterations) {
        iterations++;

        const llmResponse = await this.llmFactory.invokeWithTools(
          messages,
          toolDefs as Parameters<typeof this.llmFactory.invokeWithTools>[1],
          0.3,
          2048,
        );

        if (llmResponse.content) {
          accumulated += llmResponse.content;
          yield {
            type: 'chunk',
            data: { content: llmResponse.content },
            timestamp: new Date(),
          };
          messages.push({ role: 'assistant', content: llmResponse.content });
        }

        if (!llmResponse.toolCalls || llmResponse.toolCalls.length === 0) {
          break;
        }

        for (const tc of llmResponse.toolCalls) {
          yield {
            type: 'tool_call',
            data: { name: tc.name, input: tc.arguments },
            timestamp: new Date(),
          };

          const result = await this.executeToolCall({
            tool: tc.name,
            input: tc.arguments,
            hermesAgentId: request.hermesAgentId,
            sessionId: request.sessionId,
            tenantId: request.context.tenantId,
            workspaceId: request.context.workspaceId,
            userId: request.context.userId,
          });

          yield {
            type: 'tool_result',
            data: { tool: tc.name, output: result.output, error: result.error },
            timestamp: new Date(),
          };

          messages.push({
            role: 'tool',
            content: JSON.stringify(result.output ?? { error: result.error }),
          });
        }
      }

      yield {
        type: 'done',
        data: { content: accumulated, durationMs: Date.now() - start },
        timestamp: new Date(),
      };
    } catch (err) {
      yield {
        type: 'error',
        data: { error: err instanceof Error ? err.message : String(err) },
        timestamp: new Date(),
      };
    }
  }

  async suspend(agentId: string, tenantId: string): Promise<void> {
    await this.registry.updateStatus(agentId, 'SUSPENDED', tenantId);
    this.logger.log(`[HermesRuntime] Agent ${agentId} suspended`);
  }

  async resume(agentId: string, tenantId: string): Promise<void> {
    await this.registry.updateStatus(agentId, 'IDLE', tenantId);
    this.logger.log(`[HermesRuntime] Agent ${agentId} resumed`);
  }

  async getStatus(agentId: string, tenantId: string): Promise<string> {
    const agent = await this.registry.findById(agentId, tenantId);
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);
    return agent.status;
  }

  async createSession(
    agentId: string,
    userId: string,
    tenantId: string,
    workspaceId?: string,
  ) {
    const agent = await this.registry.findById(agentId, tenantId);
    if (!agent) throw new NotFoundException(`Agent ${agentId} not found`);
    if (!agent.isActive) throw new ForbiddenException('Agent is not active');
    return this.sessions.create(agentId, userId, tenantId, workspaceId);
  }

  private async executeToolCall(params: {
    tool: string;
    input: Record<string, unknown>;
    hermesAgentId: string;
    sessionId: string;
    tenantId: string;
    workspaceId?: string;
    userId?: string;
  }): Promise<ToolCallResult> {
    const start = Date.now();
    const {
      tool,
      input,
      hermesAgentId,
      sessionId,
      tenantId,
      workspaceId,
      userId,
    } = params;

    const decision = await this.toolGateway.validate({
      hermesAgentId,
      toolName: tool,
      toolInput: input,
      sessionId,
      tenantId,
      workspaceId,
      userId,
    });

    if (!decision.allowed) {
      return {
        tool,
        input,
        allowed: false,
        error: decision.reason ?? 'Tool execution denied',
        durationMs: Date.now() - start,
      };
    }

    const result = await this.toolGateway.execute({
      hermesAgentId,
      toolName: tool,
      toolInput: decision.sanitizedInput ?? input,
      sessionId,
      tenantId,
      workspaceId,
      userId,
    });

    return {
      tool,
      input,
      output: result.output,
      error: result.error,
      allowed: true,
      durationMs: Date.now() - start,
    };
  }
}
