import { Injectable, Logger } from '@nestjs/common';
import { EventsGateway } from '../../events/events.gateway';
import { HermesRuntimeService } from '../services/hermes-runtime.service';

export type HermesEventType =
  | 'hermes.session.created'
  | 'hermes.session.ended'
  | 'hermes.message.added'
  | 'hermes.task.started'
  | 'hermes.task.completed'
  | 'hermes.task.failed'
  | 'hermes.approval.requested'
  | 'hermes.approval.decided'
  | 'hermes.tool.executed'
  | 'hermes.tool.denied';

export interface HermesEvent {
  type: HermesEventType;
  tenantId: string;
  agentId: string;
  sessionId?: string;
  threadId?: string;
  data: Record<string, unknown>;
  timestamp: Date;
}

export type HermesEventHandler = (event: HermesEvent) => void | Promise<void>;

@Injectable()
export class HermesEventBusService {
  private readonly logger = new Logger(HermesEventBusService.name);
  private handlers: Map<HermesEventType, HermesEventHandler[]> = new Map();
  private langGraphResumeCallbacks: Map<
    string,
    (decision: 'APPROVED' | 'REJECTED') => void
  > = new Map();

  constructor(private readonly events: EventsGateway) {}

  on(type: HermesEventType, handler: HermesEventHandler): void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, []);
    }
    this.handlers.get(type)!.push(handler);
  }

  off(type: HermesEventType, handler: HermesEventHandler): void {
    const handlers = this.handlers.get(type);
    if (handlers) {
      const idx = handlers.indexOf(handler);
      if (idx !== -1) handlers.splice(idx, 1);
    }
  }

  async emit(event: HermesEvent): Promise<void> {
    this.logger.debug(
      `[HermesEventBus] Emitting ${event.type} for agent ${event.agentId}`,
    );

    this.events.emitToTenant(event.tenantId, `hermes:${event.type}`, event);

    const handlers = this.handlers.get(event.type) ?? [];
    for (const handler of handlers) {
      try {
        await handler(event);
      } catch (err) {
        this.logger.error(
          `[HermesEventBus] Handler error for ${event.type}: ${err}`,
        );
      }
    }
  }

  registerLangGraphResumeCallback(
    workflowId: string,
    callback: (decision: 'APPROVED' | 'REJECTED') => void,
  ): void {
    this.langGraphResumeCallbacks.set(workflowId, callback);
  }

  unregisterLangGraphResumeCallback(workflowId: string): void {
    this.langGraphResumeCallbacks.delete(workflowId);
  }

  notifyLangGraphResume(
    workflowId: string,
    decision: 'APPROVED' | 'REJECTED',
  ): void {
    const callback = this.langGraphResumeCallbacks.get(workflowId);
    if (callback) {
      callback(decision);
      this.langGraphResumeCallbacks.delete(workflowId);
    }
  }

  emitSessionCreated(
    tenantId: string,
    agentId: string,
    sessionId: string,
    threadId: string,
  ): void {
    this.emit({
      type: 'hermes.session.created',
      tenantId,
      agentId,
      sessionId,
      threadId,
      data: { sessionId, threadId },
      timestamp: new Date(),
    });
  }

  emitTaskStarted(
    tenantId: string,
    agentId: string,
    sessionId: string,
    task: string,
  ): void {
    this.emit({
      type: 'hermes.task.started',
      tenantId,
      agentId,
      sessionId,
      data: { task },
      timestamp: new Date(),
    });
  }

  emitTaskCompleted(
    tenantId: string,
    agentId: string,
    sessionId: string,
    output: unknown,
    durationMs: number,
  ): void {
    this.emit({
      type: 'hermes.task.completed',
      tenantId,
      agentId,
      sessionId,
      data: { output, durationMs },
      timestamp: new Date(),
    });
  }

  emitTaskFailed(
    tenantId: string,
    agentId: string,
    sessionId: string,
    error: string,
  ): void {
    this.emit({
      type: 'hermes.task.failed',
      tenantId,
      agentId,
      sessionId,
      data: { error },
      timestamp: new Date(),
    });
  }

  emitApprovalRequested(
    tenantId: string,
    agentId: string,
    workflowId: string,
    context: Record<string, unknown>,
  ): void {
    this.emit({
      type: 'hermes.approval.requested',
      tenantId,
      agentId,
      data: { workflowId, context },
      timestamp: new Date(),
    });
  }

  emitApprovalDecided(
    tenantId: string,
    agentId: string,
    workflowId: string,
    decision: 'APPROVED' | 'REJECTED',
    decidedBy: string,
  ): void {
    this.emit({
      type: 'hermes.approval.decided',
      tenantId,
      agentId,
      data: { workflowId, decision, decidedBy },
      timestamp: new Date(),
    });
  }

  emitToolExecuted(
    tenantId: string,
    agentId: string,
    sessionId: string,
    tool: string,
    allowed: boolean,
  ): void {
    this.emit({
      type: 'hermes.tool.executed',
      tenantId,
      agentId,
      sessionId,
      data: { tool, allowed },
      timestamp: new Date(),
    });
  }
}
