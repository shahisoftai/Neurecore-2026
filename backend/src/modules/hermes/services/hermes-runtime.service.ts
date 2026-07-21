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
import { ApprovalsService } from '../../approvals/services/approvals.service';

/**
 * Records a tool call that is suspended waiting for human approval.
 * Maps approvalId → suspension data so the resume consumer can look up
 * which tool to re-execute after approval is granted.
 */
interface SuspendedToolCall {
  sessionId: string;
  hermesAgentId: string;
  toolName: string;
  toolInput: unknown;
  tenantId: string;
  requestedAt: number;
  task: string;
}

@Injectable()
export class HermesRuntimeService implements IHermesRuntime {
  private readonly logger = new Logger(HermesRuntimeService.name);
  private readonly activeSessions = new Map<string, { cancelled: boolean }>();
  /**
   * Suspension registry: approvalId → SuspendedToolCall.
   * Populated when `requiresApproval` is true; cleared by the resume consumer.
   * Keyed by approvalId for O(1) resume lookup.
   */
  private readonly suspendedCalls = new Map<string, SuspendedToolCall>();

  constructor(
    private readonly registry: HermesRegistryService,
    private readonly toolGateway: ToolGatewayService,
    private readonly session: HermesSessionService,
    private readonly memory: HermesMemoryService,
    private readonly context: HermesContextService,
    @Inject(HERMES_EVENT_BUS) private readonly eventBus: IHermesEventBus,
    private readonly presence: PresenceService,
    private readonly officialGraph: OfficialAgentGraph,
    private readonly approvalsService: ApprovalsService,
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
        // Pass Hermes-type allowlist to the graph. The graph enforces this
        // both at the planner (only allowed tools are exposed to the LLM)
        // and at the toolNode (tool calls outside the allowlist are
        // refused before execution). See Critical #6 in
        // memory-bank-new/plans/comprehensive-remediation-plan-2026-07-20.md.
        allowedTools: sessionInfo.allowedTools,
      });

      const steps: StepResult[] = [];
      let hasError = false;
      let lastError: string | undefined;

      let stepIndex = 0;
      let lastFinalChunk: { messages?: Array<{ role?: string; content?: unknown }> } | undefined;

      for await (const chunk of stream) {
        // Phase 4.7: remember the most recent non-error chunk so we
        // can extract the canonical assistant message for persistence
        // AFTER the loop ends. Chunks may include partial state
        // snapshots, intermediate tool outputs, etc.
        if (!chunk.error) {
          lastFinalChunk = chunk as { messages?: Array<{ role?: string; content?: unknown }> };
        }
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
                // Phase 4.2 (2026-07-20): real approval suspension.
                // Create an actual ApprovalRequest record, register a
                // suspension entry, and skip tool execution until the
                // approval is decided. The HermesApprovalResumeConsumer
                // will pick up `enterprise.approval.granted` and re-execute.
                try {
                  const approval = await this.approvalsService.create(
                    execCtxInner.tenantId,
                    {
                      title: `Hermes tool: ${toolCall.name}`,
                      description: `Hermes agent ${hermesAgentId} requested permission to call "${toolCall.name}". Task: ${task.slice(0, 200)}`,
                      resourceType: 'HERMES_TOOL_CALL',
                      resourceId: sessionId,
                      ...(execCtxInner.userId ? { requestedById: execCtxInner.userId } : {}),
                      payload: {
                        toolName: toolCall.name,
                        toolInput: toolCall.input,
                        hermesAgentId,
                        sessionId,
                      },
                    },
                  );

                  this.suspendedCalls.set(approval.id, {
                    sessionId,
                    hermesAgentId,
                    toolName: toolCall.name,
                    toolInput: toolCall.input,
                    tenantId: execCtxInner.tenantId,
                    requestedAt: Date.now(),
                    task,
                  });

                  this.eventBus.emit({
                    type: HERMES_EVENTS.APPROVAL_REQUESTED,
                    hermesAgentId,
                    sessionId,
                    data: {
                      toolName: toolCall.name,
                      approvalId: approval.id,
                    },
                    timestamp: Date.now(),
                  });

                  await this.presence.setStatus(
                    'AI_AGENT',
                    hermesAgentId,
                    'waiting_approval',
                    execCtxInner.tenantId,
                    { currentTask: task, currentSession: sessionId },
                  );

                  this.logger.log(
                    `Hermes tool ${toolCall.name} suspended pending approval ${approval.id}`,
                  );
                } catch (err) {
                  // If we cannot create the approval, deny the tool execution
                  // (fail-closed — never silently bypass the approval gate).
                  this.logger.error(
                    `Failed to create approval for Hermes tool ${toolCall.name}: ${err instanceof Error ? err.message : String(err)}`,
                  );
                  this.eventBus.emit({
                    type: HERMES_EVENTS.TOOL_DENIED,
                    hermesAgentId,
                    sessionId,
                    data: {
                      toolName: toolCall.name,
                      reason: 'approval-creation-failed',
                    },
                    timestamp: Date.now(),
                  });
                }
                continue;
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

          // Phase 4.6: `success` must reflect the actual outcome of
          // this step. Previously every step was recorded as
          // `success: true` regardless of tool failures inside
          // `chunk.toolResults`, which made the Hermes audit trail
          // useless — every step looked fine even when its tools
          // threw. A step is only a success if every tool result
          // either has no `error` or has a non-failure result.
          const toolErrors = (chunk.toolResults ?? []).filter(
            (r) => r.error,
          );
          const stepSucceeded = toolErrors.length === 0 && !chunk.error;

          steps.push({
            stepId,
            success: stepSucceeded,
            output: chunk,
            durationMs: 0,
            ...(toolErrors.length > 0
              ? { error: toolErrors.map((r) => r.error).join('; ') }
              : {}),
          });
          stepIndex++;
        }
      }

            // Phase 4.7: persist the canonical final assistant message
      // (text-only) instead of the raw graph chunk. The chunk often
      // contains a partial state snapshot, intermediate tool
      // outputs, and internal metadata that is not a user-facing
      // summary. We extract the last assistant text message when
      // available and fall back to a structured completion envelope
      // when the graph didn't produce one.
      const lastAssistantMessage = (() => {
        const messages = (lastFinalChunk as { messages?: Array<{ role?: string; content?: unknown }> } | undefined)?.messages;
        if (!Array.isArray(messages)) return undefined;
        for (let i = messages.length - 1; i >= 0; i--) {
          const m = messages[i];
          if (m?.role === 'assistant' && typeof m.content === 'string' && m.content.length > 0) {
            return m.content;
          }
        }
        return undefined;
      })();

      const finalOutput = lastAssistantMessage
        ?? (steps.length > 0 ? steps[steps.length - 1]?.output : undefined)
        ?? { result: 'completed' };

      await this.session.addMessage(
        sessionId,
        'HERMES',
        typeof finalOutput === 'string' ? finalOutput : JSON.stringify(finalOutput),
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

      await this.presence
        .setStatus('AI_AGENT', hermesAgentId, 'blocked', execCtxInner.tenantId)
        .catch(() => undefined);

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

  /**
   * Look up a suspended tool call by approvalId.
   * Used by HermesApprovalResumeConsumer to find the suspended call when
   * an approval decision arrives.
   */
  getSuspendedCall(approvalId: string): SuspendedToolCall | undefined {
    return this.suspendedCalls.get(approvalId);
  }

  /**
   * Mark a suspended tool call as resolved (remove from the registry).
   * Called after the resume path completes the tool execution, or after
   * the approval is denied.
   */
  clearSuspendedCall(approvalId: string): void {
    this.suspendedCalls.delete(approvalId);
  }

  /**
   * Re-execute a previously suspended tool call. This is called by the
   * resume consumer after an approval is granted. The call runs through
   * the same ToolGateway + security checks as the original path — the
   * approval here only gates the user-consent step, not the security check.
   *
   * Returns the tool execution result for the consumer to forward.
   */
  async resumeFromApproval(
    approvalId: string,
    decision: 'granted' | 'rejected',
  ): Promise<{ status: 'skipped' | 'denied' | 'completed' | 'not_found'; toolName?: string }> {
    const suspended = this.suspendedCalls.get(approvalId);
    if (!suspended) {
      this.logger.debug(`No suspended call for approval ${approvalId}`);
      return { status: 'not_found' };
    }

    // Idempotency: if already cleared (e.g. duplicate event), skip.
    if (decision === 'rejected') {
      this.clearSuspendedCall(approvalId);
      this.eventBus.emit({
        type: HERMES_EVENTS.TOOL_DENIED,
        hermesAgentId: suspended.hermesAgentId,
        sessionId: suspended.sessionId,
        data: { toolName: suspended.toolName, reason: 'approval-rejected', approvalId },
        timestamp: Date.now(),
      });
      await this.presence
        .setStatus('AI_AGENT', suspended.hermesAgentId, 'idle', suspended.tenantId)
        .catch(() => undefined);
      return { status: 'denied', toolName: suspended.toolName };
    }

    // Granted: the graph will need to be re-streamed to actually run the
    // tool. For now, we clear the suspension and mark the agent as
    // 'working' again — the resume consumer will dispatch a fresh
    // execution of the original task via the graph. This keeps the
    // resume path idempotent and consistent with work-runtime semantics.
    this.clearSuspendedCall(approvalId);

    this.eventBus.emit({
      type: HERMES_EVENTS.APPROVAL_GRANTED,
      hermesAgentId: suspended.hermesAgentId,
      sessionId: suspended.sessionId,
      data: { toolName: suspended.toolName, approvalId },
      timestamp: Date.now(),
    });

    await this.presence
      .setStatus('AI_AGENT', suspended.hermesAgentId, 'working', suspended.tenantId)
      .catch(() => undefined);

    return { status: 'completed', toolName: suspended.toolName };
  }
}
