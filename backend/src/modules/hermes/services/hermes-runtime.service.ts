import { Inject, Injectable, Logger } from '@nestjs/common';
import type { IHermesRuntime } from '../interfaces/hermes-runtime.interface';
import type {
  HermesExecutionContext,
  HermesExecuteResult,
} from '../common/hermes.types';
import { HERMES_EVENTS } from '../common/hermes.constants';
import { HermesRegistryService } from './hermes-registry.service';
import { ToolGatewayService } from './tool-gateway.service';
import { HermesSessionService } from './hermes-session.service';
import { HermesMemoryService } from './hermes-memory.service';
import { HermesContextService } from './hermes-context.service';
import {
  HERMES_EVENT_BUS,
  type IHermesEventBus,
} from '../interfaces/hermes-event-bus.interface';
import { PresenceService } from './presence.service';
import { OfficialAgentGraph } from '../../agents/langgraph/langgraph-official';
import type { StepResult } from '../../agents/interfaces/agent-executor.interface';

@Injectable()
export class HermesRuntimeService implements IHermesRuntime {
  private readonly logger = new Logger(HermesRuntimeService.name);
  private readonly activeSessions = new Map<string, { cancelled: boolean }>();

  constructor(
    private readonly registry: HermesRegistryService,
    private readonly toolGateway: ToolGatewayService,
    private readonly session: HermesSessionService,
    private readonly memory: HermesMemoryService,
    private readonly context: HermesContextService,
    @Inject(HERMES_EVENT_BUS) private readonly eventBus: IHermesEventBus,
    private readonly presence: PresenceService,
    private readonly officialGraph: OfficialAgentGraph,
  ) {}

  async execute(execCtx: HermesExecutionContext): Promise<HermesExecuteResult> {
    const start = Date.now();
    const {
      sessionId,
      hermesAgentId,
      task,
      context: execCtxInner,
      autoLink,
    } = execCtx;

    this.activeSessions.set(sessionId, { cancelled: false });

    try {
      let profile = await this.registry.findById(hermesAgentId);

      if (!profile && autoLink && execCtxInner.agentId) {
        this.logger.log(`Auto-linking Agent ${execCtxInner.agentId} to Hermes`);
        profile = await this.registry.ensureHermesAgent(
          execCtxInner.agentId,
          execCtxInner.tenantId,
        );
      }

      if (!profile || !profile.isActive) {
        throw new Error(`HermesAgent ${hermesAgentId} not found or inactive`);
      }

      const sessionInfo = await this.context.build({
        hermesAgentId,
        agentId: execCtxInner.agentId ?? hermesAgentId,
        tenantId: execCtxInner.tenantId,
        userId: execCtxInner.userId,
        workspaceId: execCtxInner.workspaceId,
        threadId: execCtxInner.threadId,
      });

      this.logger.debug(
        `Hermes context built, tools: ${sessionInfo.allowedTools.length}`,
      );

      this.eventBus.emit({
        type: HERMES_EVENTS.EXECUTION_STARTED,
        hermesAgentId,
        sessionId,
        data: { task, tenantId: execCtxInner.tenantId },
        timestamp: Date.now(),
      });

      await this.presence.setStatus(
        'AI_AGENT',
        hermesAgentId,
        'working',
        execCtxInner.tenantId,
        { currentTask: task, currentSession: sessionId },
      );

      await this.session.addMessage(sessionId, 'USER', task);

      const stream = this.officialGraph.stream({
        goal: task,
        agentId: execCtxInner.agentId ?? hermesAgentId,
        tenantId: execCtxInner.tenantId,
        userId: execCtxInner.userId ?? 'hermes',
        sessionId,
      });

      const steps: StepResult[] = [];
      let hasError = false;
      let lastError: string | undefined;

      let stepIndex = 0;
      for await (const chunk of stream) {
        if (this.activeSessions.get(sessionId)?.cancelled) {
          throw new Error('Execution cancelled');
        }

        if (chunk.error) {
          hasError = true;
          lastError = chunk.error;
          steps.push({
            stepId: `hermes-step-${stepIndex}`,
            success: false,
            error: chunk.error,
            durationMs: 0,
          });
          stepIndex++;
          continue;
        }

        if (chunk.currentNode) {
          const stepId = `hermes-step-${stepIndex}`;
          this.logger.debug(`Hermes node: ${chunk.currentNode}`);

          if (chunk.toolCalls && chunk.toolCalls.length > 0) {
            for (const toolCall of chunk.toolCalls) {
              const validation = this.toolGateway.validate(
                toolCall.name,
                profile.type,
                {
                  tenantId: execCtxInner.tenantId,
                  userId: execCtxInner.userId,
                },
              );

              if (!validation.allowed) {
                this.eventBus.emit({
                  type: HERMES_EVENTS.TOOL_DENIED,
                  hermesAgentId,
                  sessionId,
                  data: { toolName: toolCall.name, reason: validation.reason },
                  timestamp: Date.now(),
                });
                continue;
              }

              this.eventBus.emit({
                type: HERMES_EVENTS.TOOL_CALL,
                hermesAgentId,
                sessionId,
                data: { toolName: toolCall.name, input: toolCall.input },
                timestamp: Date.now(),
              });

              if (validation.requiresApproval) {
                this.eventBus.emit({
                  type: HERMES_EVENTS.APPROVAL_REQUESTED,
                  hermesAgentId,
                  sessionId,
                  data: { toolName: toolCall.name },
                  timestamp: Date.now(),
                });
                await this.presence.setStatus(
                  'AI_AGENT',
                  hermesAgentId,
                  'waiting_approval',
                  execCtxInner.tenantId,
                  { currentTask: task, currentSession: sessionId },
                );
              }
            }
          }

          if (chunk.toolResults && chunk.toolResults.length > 0) {
            for (const result of chunk.toolResults) {
              this.eventBus.emit({
                type: HERMES_EVENTS.TOOL_RESULT,
                hermesAgentId,
                sessionId,
                data: {
                  toolName: result.toolName,
                  output: result.output,
                  error: result.error,
                },
                timestamp: Date.now(),
              });
            }
          }

          steps.push({
            stepId,
            success: true,
            output: chunk,
            durationMs: 0,
          });
          stepIndex++;
        }
      }

      const finalOutput =
        steps.length > 0 ? steps[steps.length - 1]?.output : undefined;

      await this.session.addMessage(
        sessionId,
        'HERMES',
        JSON.stringify(finalOutput ?? { result: 'completed' }),
      );

      await this.memory.summarize(hermesAgentId, task, execCtxInner.tenantId);

      this.eventBus.emit({
        type: HERMES_EVENTS.EXECUTION_COMPLETED,
        hermesAgentId,
        sessionId,
        data: { success: !hasError, steps: steps.length },
        timestamp: Date.now(),
      });

      await this.presence.setStatus(
        'AI_AGENT',
        hermesAgentId,
        'idle',
        execCtxInner.tenantId,
      );

      return {
        success: !hasError,
        output: finalOutput,
        error: lastError,
        steps,
        durationMs: Date.now() - start,
      };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.logger.error(`Hermes execution failed: ${errMsg}`);

      this.eventBus.emit({
        type: HERMES_EVENTS.ERROR,
        hermesAgentId,
        sessionId,
        data: { error: errMsg },
        timestamp: Date.now(),
      });

      await this.presence.setStatus(
        'AI_AGENT',
        hermesAgentId,
        'blocked',
        execCtxInner.tenantId,
      ).catch(() => undefined);

      return {
        success: false,
        error: errMsg,
        steps: [],
        durationMs: Date.now() - start,
      };
    } finally {
      this.activeSessions.delete(sessionId);
    }
  }

  async getStatus(hermesAgentId: string): Promise<string> {
    const profile = await this.registry.findById(hermesAgentId);
    return profile?.status ?? 'UNKNOWN';
  }

  cancel(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.cancelled = true;
    }
  }
}
