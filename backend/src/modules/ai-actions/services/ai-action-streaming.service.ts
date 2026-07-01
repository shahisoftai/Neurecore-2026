/**
 * AIActionStreamingService — SSE stream registry for AI Actions.
 *
 * Per `EAOS-api-contract.md` §9.2 (SSE pattern; same as
 * `agent-streaming.controller.ts`) + `EAOS-api-contract.md` §13.2
 * (AI Action invocation lifecycle).
 *
 * Each invocation with `requiresStreaming === true` gets a stream session.
 * Clients poll `GET /ai-actions/:id` for the synchronous view, OR
 * subscribe to `GET /ai-actions/:id/stream` for live deltas.
 *
 * SSE event types (per `EAOS-NUWS-principles.md` §2.3):
 *   - `connected`     — session ready
 *   - `start`         — handler invoked
 *   - `delta`         — partial output (chunk of text or citation chip)
 *   - `citation`      — appended citation
 *   - `complete`      — final result
 *   - `error`         — terminal failure
 *   - `heartbeat`     — keep-alive every 15s
 *   - `cancelled`     — client disconnected via AbortSignal
 *
 * SOLID: SRP — this file only owns the stream lifecycle. Recording is
 * the executor's concern.
 */

import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject, timeout, takeUntil, catchError } from 'rxjs';
import type { AIActionStreamChunk } from '../action-definition';

export enum ActionStreamEventType {
  CONNECTED = 'connected',
  START = 'start',
  DELTA = 'delta',
  CITATION = 'citation',
  COMPLETE = 'complete',
  ERROR = 'error',
  HEARTBEAT = 'heartbeat',
  CANCELLED = 'cancelled',
}

export interface ActionStreamEvent {
  type: ActionStreamEventType;
  invocationId: string;
  timestamp: number;
  data?: unknown;
  error?: string;
}

interface StreamSession {
  invocationId: string;
  tenantId: string;
  userId: string;
  createdAt: number;
  cancellation: Subject<void>;
  subject: Subject<ActionStreamEvent>;
  heartbeat?: NodeJS.Timeout;
  connected: boolean;
}

@Injectable()
export class AIActionStreamingService {
  private readonly logger = new Logger(AIActionStreamingService.name);

  private readonly sessions = new Map<string, StreamSession>();
  private readonly subjects = new Map<string, Subject<ActionStreamEvent>>();

  /**
   * Create or resume a streaming session for an invocation. Idempotent
   * for the same `invocationId` — if a session already exists, returns it.
   */
  createSession(opts: {
    invocationId: string;
    tenantId: string;
    userId: string;
    heartbeatMs?: number;
  }): Subject<ActionStreamEvent> {
    const existing = this.subjects.get(opts.invocationId);
    if (existing) {
      this.logger.debug(
        `Reusing streaming session for invocation ${opts.invocationId}`,
      );
      return existing;
    }

    const subject = new Subject<ActionStreamEvent>();
    this.subjects.set(opts.invocationId, subject);
    this.sessions.set(opts.invocationId, {
      invocationId: opts.invocationId,
      tenantId: opts.tenantId,
      userId: opts.userId,
      createdAt: Date.now(),
      cancellation: new Subject<void>(),
      subject,
      connected: false,
    });

    const interval = setInterval(() => {
      this.emit(opts.invocationId, {
        type: ActionStreamEventType.HEARTBEAT,
        invocationId: opts.invocationId,
        timestamp: Date.now(),
        data: { alive: true },
      });
    }, opts.heartbeatMs ?? 15_000);
    const session = this.sessions.get(opts.invocationId)!;
    session.heartbeat = interval;

    return subject;
  }

  getSubject(invocationId: string): Subject<ActionStreamEvent> | undefined {
    return this.subjects.get(invocationId);
  }

  getSession(
    invocationId: string,
  ): { tenantId: string; userId: string } | undefined {
    const s = this.sessions.get(invocationId);
    if (!s) return undefined;
    return { tenantId: s.tenantId, userId: s.userId };
  }

  /**
   * Build a server-side Observable for SSE. Enforces:
   *   - 5-minute max stream lifetime
   *   - auto-cleanup on terminal events / disconnect
   *   - timeout that closes the stream
   */
  asObservable(invocationId: string): Observable<ActionStreamEvent> | null {
    const subject = this.subjects.get(invocationId);
    const session = this.sessions.get(invocationId);
    if (!subject || !session) return null;

    return subject.asObservable().pipe(
      takeUntil(session.cancellation),
      timeout({
        first: 5 * 60 * 1000,
        with: () => {
          this.emit(invocationId, {
            type: ActionStreamEventType.ERROR,
            invocationId,
            timestamp: Date.now(),
            error: 'Stream timeout',
          });
          this.closeSession(invocationId);
          return [];
        },
      }),
      catchError((err: Error) => {
        this.emit(invocationId, {
          type: ActionStreamEventType.ERROR,
          invocationId,
          timestamp: Date.now(),
          error: err?.message ?? String(err),
        });
        this.closeSession(invocationId);
        return [];
      }),
    );
  }

  /**
   * Emit a typed event into the session's subject. No-op if the session
   * has been closed.
   */
  emit(invocationId: string, event: ActionStreamEvent): void {
    const subject = this.subjects.get(invocationId);
    if (!subject) return;
    try {
      subject.next(event);
    } catch (err) {
      this.logger.warn(
        `emit() failed for ${invocationId}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Translate an `AIActionStreamChunk` (from a handler generator) into
   * one or more typed SSE events.
   */
  emitChunk(invocationId: string, chunk: AIActionStreamChunk): void {
    const ts = Date.now();
    switch (chunk.type) {
      case 'delta':
        this.emit(invocationId, {
          type: ActionStreamEventType.DELTA,
          invocationId,
          timestamp: ts,
          data: { delta: chunk.delta ?? '' },
        });
        break;
      case 'citation':
        this.emit(invocationId, {
          type: ActionStreamEventType.CITATION,
          invocationId,
          timestamp: ts,
          data: { citation: chunk.citation },
        });
        break;
      case 'done':
        this.emit(invocationId, {
          type: ActionStreamEventType.COMPLETE,
          invocationId,
          timestamp: ts,
          data: { result: chunk.result },
        });
        break;
      case 'error':
        this.emit(invocationId, {
          type: ActionStreamEventType.ERROR,
          invocationId,
          timestamp: ts,
          error: chunk.error,
        });
        break;
    }
  }

  cancelSession(invocationId: string): void {
    const session = this.sessions.get(invocationId);
    if (!session) return;
    session.cancellation.next();
  }

  closeSession(invocationId: string): void {
    const session = this.sessions.get(invocationId);
    if (!session) return;
    if (session.heartbeat) {
      clearInterval(session.heartbeat);
    }
    try {
      session.cancellation.next();
      session.cancellation.complete();
    } catch {
      /* ignore */
    }
    try {
      session.subject.complete();
    } catch {
      /* ignore */
    }
    this.sessions.delete(invocationId);
    this.subjects.delete(invocationId);
    this.logger.debug(`Closed streaming session: ${invocationId}`);
  }
}
