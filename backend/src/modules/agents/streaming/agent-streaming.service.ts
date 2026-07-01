/**
 * Agent Streaming Service
 *
 * Provides Server-Sent Events (SSE) streaming for real-time agent execution updates.
 * Implements the Observable pattern for clean stream management.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, timeout, catchError, takeUntil } from 'rxjs';

/**
 * Streaming event types for agent execution
 */
export enum StreamingEventType {
  // Connection events
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  ERROR = 'error',

  // Execution events
  START = 'start',
  STEP_START = 'step_start',
  STEP_COMPLETE = 'step_complete',
  STEP_ERROR = 'step_error',
  TOOL_CALL = 'tool_call',
  TOOL_RESULT = 'tool_result',
  THINKING = 'thinking',

  // Completion events
  COMPLETE = 'complete',
  CANCELLED = 'cancelled',

  // Progress events
  PROGRESS = 'progress',
  HEARTBEAT = 'heartbeat',
}

/**
 * Base streaming event structure
 */
export interface StreamingEvent {
  type: StreamingEventType;
  timestamp: number;
  sessionId: string;
  data?: unknown;
  error?: string;
}

/**
 * Agent execution streaming event
 */
export interface AgentStreamingEvent extends StreamingEvent {
  type: StreamingEventType;
  taskId?: string;
  stepIndex?: number;
  stepCount?: number;
  step?: {
    id: string;
    description: string;
    status: 'pending' | 'running' | 'complete' | 'error';
  };
  tool?: {
    name: string;
    input: unknown;
    output?: unknown;
    error?: string;
    durationMs?: number;
  };
  reasoning?: string;
  progress?: number;
}

/**
 * Connection info for a streaming session
 */
export interface StreamingConnection {
  sessionId: string;
  taskId: string;
  userId?: string;
  tenantId?: string;
  connectedAt: number;
  lastActivity: number;
}

/**
 * Options for creating a stream
 */
export interface StreamOptions {
  taskId: string;
  sessionId: string;
  userId?: string;
  tenantId?: string;
  heartbeatIntervalMs?: number;
  timeoutMs?: number;
}

/**
 * Agent Streaming Service
 *
 * Manages SSE streams for agent execution with:
 * - Session management
 * - Heartbeat/keepalive
 * - Automatic cleanup
 * - Event filtering
 */
@Injectable()
export class AgentStreamingService {
  private readonly logger = new Logger(AgentStreamingService.name);

  // Active streaming sessions
  private readonly sessions: Map<string, StreamingConnection> = new Map();

  // Event subjects per session
  private readonly eventSubjects: Map<string, Subject<AgentStreamingEvent>> =
    new Map();

  // Heartbeat intervals per session
  private readonly heartbeatIntervals: Map<string, NodeJS.Timeout> = new Map();

  // Cancellation subjects per session
  private readonly cancellationSubjects: Map<string, Subject<void>> = new Map();

  private readonly defaultHeartbeatIntervalMs = 15000; // 15 seconds
  private readonly defaultTimeoutMs = 300000; // 5 minutes

  /**
   * Create a new streaming session
   */
  createSession(options: StreamOptions): string {
    const { sessionId, taskId, userId, tenantId } = options;

    // Check if session already exists
    if (this.sessions.has(sessionId)) {
      this.logger.warn(
        `Session ${sessionId} already exists, closing old session`,
      );
      this.closeSession(sessionId);
    }

    // Create connection info
    const connection: StreamingConnection = {
      sessionId,
      taskId,
      userId,
      tenantId,
      connectedAt: Date.now(),
      lastActivity: Date.now(),
    };

    this.sessions.set(sessionId, connection);

    // Create event subject
    const subject = new Subject<AgentStreamingEvent>();
    this.eventSubjects.set(sessionId, subject);

    // Create cancellation subject
    const cancellation = new Subject<void>();
    this.cancellationSubjects.set(sessionId, cancellation);

    // Start heartbeat
    const heartbeatInterval =
      options.heartbeatIntervalMs ?? this.defaultHeartbeatIntervalMs;
    const interval = setInterval(() => {
      this.emit(sessionId, {
        type: StreamingEventType.HEARTBEAT,
        timestamp: Date.now(),
        sessionId,
        data: { alive: true },
      });
    }, heartbeatInterval);
    this.heartbeatIntervals.set(sessionId, interval);

    this.logger.log(
      `Created streaming session: ${sessionId} for task: ${taskId}`,
    );

    return sessionId;
  }

  /**
   * Get an observable stream for a session
   */
  getStream(
    sessionId: string,
    timeoutMs?: number,
  ): Observable<AgentStreamingEvent> | null {
    const subject = this.eventSubjects.get(sessionId);
    if (!subject) {
      return null;
    }

    const timeoutValue = timeoutMs ?? this.defaultTimeoutMs;
    const cancellation = this.cancellationSubjects.get(sessionId);

    return subject.asObservable().pipe(
      takeUntil(cancellation ?? new Subject<void>()),
      timeout({
        first: timeoutValue,
        with: () => {
          this.emit(sessionId, {
            type: StreamingEventType.ERROR,
            timestamp: Date.now(),
            sessionId,
            error: 'Stream timeout',
          });
          this.closeSession(sessionId);
          return [];
        },
      }),
      catchError((error) => {
        this.logger.error(`Stream error for session ${sessionId}:`, error);
        this.emit(sessionId, {
          type: StreamingEventType.ERROR,
          timestamp: Date.now(),
          sessionId,
          error: error instanceof Error ? error.message : String(error),
        });
        return [];
      }),
    );
  }

  /**
   * Emit an event to a session
   */
  emit(sessionId: string, event: AgentStreamingEvent): void {
    const subject = this.eventSubjects.get(sessionId);
    if (!subject) {
      this.logger.warn(
        `Attempted to emit to non-existent session: ${sessionId}`,
      );
      return;
    }

    // Update last activity
    const connection = this.sessions.get(sessionId);
    if (connection) {
      connection.lastActivity = Date.now();
    }

    // Emit event
    subject.next(event);
  }

  /**
   * Emit a start event
   */
  emitStart(sessionId: string, taskId: string): void {
    this.emit(sessionId, {
      type: StreamingEventType.START,
      timestamp: Date.now(),
      sessionId,
      taskId,
    });
  }

  /**
   * Emit a step start event
   */
  emitStepStart(
    sessionId: string,
    taskId: string,
    stepIndex: number,
    stepCount: number,
    step: { id: string; description: string },
  ): void {
    this.emit(sessionId, {
      type: StreamingEventType.STEP_START,
      timestamp: Date.now(),
      sessionId,
      taskId,
      stepIndex,
      stepCount,
      step: { ...step, status: 'running' },
      progress: (stepIndex / stepCount) * 100,
    });
  }

  /**
   * Emit a step complete event
   */
  emitStepComplete(
    sessionId: string,
    taskId: string,
    stepIndex: number,
    stepCount: number,
    step: { id: string; description: string },
    result?: unknown,
  ): void {
    this.emit(sessionId, {
      type: StreamingEventType.STEP_COMPLETE,
      timestamp: Date.now(),
      sessionId,
      taskId,
      stepIndex,
      stepCount,
      step: { ...step, status: 'complete' },
      data: result,
      progress: ((stepIndex + 1) / stepCount) * 100,
    });
  }

  /**
   * Emit a step error event
   */
  emitStepError(
    sessionId: string,
    taskId: string,
    stepIndex: number,
    stepCount: number,
    step: { id: string; description: string },
    error: string,
  ): void {
    this.emit(sessionId, {
      type: StreamingEventType.STEP_ERROR,
      timestamp: Date.now(),
      sessionId,
      taskId,
      stepIndex,
      stepCount,
      step: { ...step, status: 'error' },
      error,
      progress: (stepIndex / stepCount) * 100,
    });
  }

  /**
   * Emit a tool call event
   */
  emitToolCall(
    sessionId: string,
    taskId: string,
    toolName: string,
    toolInput: unknown,
  ): void {
    this.emit(sessionId, {
      type: StreamingEventType.TOOL_CALL,
      timestamp: Date.now(),
      sessionId,
      taskId,
      tool: { name: toolName, input: toolInput },
    });
  }

  /**
   * Emit a tool result event
   */
  emitToolResult(
    sessionId: string,
    taskId: string,
    toolName: string,
    toolInput: unknown,
    toolOutput: unknown,
    durationMs?: number,
  ): void {
    this.emit(sessionId, {
      type: StreamingEventType.TOOL_RESULT,
      timestamp: Date.now(),
      sessionId,
      taskId,
      tool: {
        name: toolName,
        input: toolInput,
        output: toolOutput,
        durationMs,
      },
    });
  }

  /**
   * Emit a thinking/reasoning event
   */
  emitThinking(sessionId: string, taskId: string, reasoning: string): void {
    this.emit(sessionId, {
      type: StreamingEventType.THINKING,
      timestamp: Date.now(),
      sessionId,
      taskId,
      reasoning,
    });
  }

  /**
   * Emit a completion event
   */
  emitComplete(sessionId: string, taskId: string, result?: unknown): void {
    this.emit(sessionId, {
      type: StreamingEventType.COMPLETE,
      timestamp: Date.now(),
      sessionId,
      taskId,
      data: result,
      progress: 100,
    });
  }

  /**
   * Emit a cancellation event
   */
  emitCancelled(sessionId: string, taskId: string): void {
    this.emit(sessionId, {
      type: StreamingEventType.CANCELLED,
      timestamp: Date.now(),
      sessionId,
      taskId,
    });
  }

  /**
   * Cancel a session
   */
  cancelSession(sessionId: string): void {
    const cancellation = this.cancellationSubjects.get(sessionId);
    if (cancellation) {
      cancellation.next();
      cancellation.complete();
    }

    const taskId = this.sessions.get(sessionId)?.taskId;
    if (taskId) {
      this.emitCancelled(sessionId, taskId);
    }

    this.closeSession(sessionId);
  }

  /**
   * Close a session and cleanup
   */
  closeSession(sessionId: string): void {
    // Stop heartbeat
    const interval = this.heartbeatIntervals.get(sessionId);
    if (interval) {
      clearInterval(interval);
      this.heartbeatIntervals.delete(sessionId);
    }

    // Complete subjects
    const subject = this.eventSubjects.get(sessionId);
    if (subject) {
      subject.complete();
      this.eventSubjects.delete(sessionId);
    }

    const cancellation = this.cancellationSubjects.get(sessionId);
    if (cancellation && !cancellation.closed) {
      cancellation.next();
      cancellation.complete();
      this.cancellationSubjects.delete(sessionId);
    }

    // Remove session
    this.sessions.delete(sessionId);

    this.logger.log(`Closed streaming session: ${sessionId}`);
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): StreamingConnection | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): StreamingConnection[] {
    return Array.from(this.sessions.values());
  }

  /**
   * Get session count
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Cleanup stale sessions (inactivity timeout)
   */
  cleanupStaleSessions(timeoutMs: number = 60000): number {
    const now = Date.now();
    let cleaned = 0;

    for (const [sessionId, connection] of this.sessions.entries()) {
      if (now - connection.lastActivity > timeoutMs) {
        this.logger.warn(`Cleaning up stale session: ${sessionId}`);
        this.closeSession(sessionId);
        cleaned++;
      }
    }

    return cleaned;
  }
}
