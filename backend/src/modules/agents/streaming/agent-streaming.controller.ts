/**
 * Agent Streaming Controller
 *
 * Provides Server-Sent Events (SSE) endpoint for real-time agent execution streaming.
 *
 * Phase 0 (D-014, FIX-002): Every endpoint is now auth-gated. The previous
 * version accepted any `sessionId` in the URL and trusted `?userId=` / `?tenantId=`
 * query params on session creation. Now:
 *
 * - All endpoints require `JwtAuthGuard` (authenticated user).
 * - `userId` / `tenantId` on `createSession` come from the authenticated user,
 *   not from URL query params (the query params are removed entirely).
 * - `getEvents` / `cancelSession` / `getSessionStatus` / `executeWithStreaming`
 *   verify that the requested session belongs to the calling user (or the user
 *   has a platform role).
 */

import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Res,
  HttpCode,
  HttpStatus,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  UseGuards,
} from '@nestjs/common';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import type { Response } from 'express';
import { UserRole } from '@prisma/client';
import {
  AgentStreamingService,
  AgentStreamingEvent,
  StreamingEventType,
} from './agent-streaming.service';
import { AgentExecutorService } from '../services/agent-executor.service';
import { StructuredToolRegistry } from '../../tools/structured-tool.registry';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

const PLATFORM_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.PLATFORM_ADMIN,
  UserRole.SECURITY_OFFICER,
  UserRole.SUPPORT,
];

@Controller({ path: 'agents/streaming', version: '1' })
@ApiCommon('streaming')
@SkipThrottle()
@UseGuards(JwtAuthGuard)
export class AgentStreamingController {
  constructor(
    private readonly streamingService: AgentStreamingService,
    private readonly agentExecutor: AgentExecutorService,
    private readonly toolRegistry: StructuredToolRegistry,
  ) {}

  /**
   * Create a new streaming session
   */
  @Post('sessions')
  @HttpCode(HttpStatus.CREATED)
  createSession(
    @CurrentUser() user: JwtPayload,
    @Param() params: { taskId?: string },
    @Res({ passthrough: false }) _res: Response,
    // The legacy `?userId=` and `?tenantId=` query params are intentionally
    // NOT accepted here. userId/tenantId are derived from the authenticated
    // user to prevent session hijacking.
  ): { sessionId: string; url: string } {
    const taskId = (params as unknown as { taskId?: string }).taskId;
    if (!taskId) {
      throw new BadRequestException('taskId is required');
    }

    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    this.streamingService.createSession({
      taskId,
      sessionId,
      userId: user.sub,
      tenantId: user.tenantId ?? undefined,
    });

    return {
      sessionId,
      url: `/api/v1/agents/streaming/sessions/${sessionId}/events`,
    };
  }

  /**
   * Get streaming events for a session (SSE endpoint)
   */
  @Get('sessions/:sessionId/events')
  getEvents(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): void {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const session = this.streamingService.getSession(sessionId);
    if (!session) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send(`data: ${JSON.stringify({ error: 'Session not found' })}\n\n`);
      return;
    }

    // Phase 0 (FIX-002): enforce session ownership. A user can only subscribe
    // to their own sessions unless they have a platform role.
    if (!this.canAccessSession(user, session)) {
      res
        .status(HttpStatus.FORBIDDEN)
        .send(`data: ${JSON.stringify({ error: 'Cross-tenant or cross-user session access denied' })}\n\n`);
      return;
    }

    res.write(
      `data: ${JSON.stringify({
        type: StreamingEventType.CONNECTED,
        timestamp: Date.now(),
        sessionId,
        data: { sessionId, taskId: session.taskId },
      })}\n\n`,
    );

    const stream$ = this.streamingService.getStream(sessionId);
    if (!stream$) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send(`data: ${JSON.stringify({ error: 'Stream not available' })}\n\n`);
      return;
    }

    const subscription = stream$.subscribe({
      next: (event: AgentStreamingEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (
          event.type === StreamingEventType.COMPLETE ||
          event.type === StreamingEventType.CANCELLED ||
          event.type === StreamingEventType.ERROR
        ) {
          res.end();
        }
      },
      error: (error: Error) => {
        res.write(
          `data: ${JSON.stringify({
            type: StreamingEventType.ERROR,
            timestamp: Date.now(),
            sessionId,
            error: error.message,
          })}\n\n`,
        );
        res.end();
      },
      complete: () => res.end(),
    });

    res.on('close', () => {
      subscription.unsubscribe();
      this.streamingService.closeSession(sessionId);
    });
  }

  /**
   * Execute an agent task with streaming
   */
  @Post('sessions/:sessionId/execute')
  @HttpCode(HttpStatus.ACCEPTED)
  async executeWithStreaming(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
    @Res() _res: Response,
  ): Promise<{ taskId: string; status: string }> {
    const session = this.streamingService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (!this.canAccessSession(user, session)) {
      throw new ForbiddenException('Cross-tenant or cross-user session access denied');
    }

    const taskId = session.taskId;
    const agentId = session.userId ?? 'default';
    const tenantId = session.tenantId;

    // Execute in background (fire and forget)
    void this.executeAgentTask(sessionId, taskId, agentId, tenantId);

    return { taskId, status: 'started' };
  }

  /**
   * Execute agent task with streaming updates
   */
  private async executeAgentTask(
    sessionId: string,
    taskId: string,
    agentId: string,
    tenantId?: string,
  ): Promise<void> {
    try {
      this.streamingService.emitStart(sessionId, taskId);

      const result = await this.agentExecutor.executeTask(
        taskId,
        agentId,
        tenantId || 'default',
      );

      // Process results with streaming
      if (result.steps && result.steps.length > 0) {
        for (let i = 0; i < result.steps.length; i++) {
          const step = result.steps[i];
          const stepDescription = `Step ${i + 1}`;

          this.streamingService.emitStepStart(
            sessionId,
            taskId,
            i,
            result.steps.length,
            {
              id: step.stepId,
              description: stepDescription,
            },
          );

          if (step.success && step.output) {
            this.streamingService.emitStepComplete(
              sessionId,
              taskId,
              i,
              result.steps.length,
              {
                id: step.stepId,
                description: stepDescription,
              },
              step.output,
            );
          } else if (step.error) {
            this.streamingService.emitStepError(
              sessionId,
              taskId,
              i,
              result.steps.length,
              {
                id: step.stepId,
                description: stepDescription,
              },
              step.error,
            );
          } else {
            this.streamingService.emitStepComplete(
              sessionId,
              taskId,
              i,
              result.steps.length,
              {
                id: step.stepId,
                description: stepDescription,
              },
            );
          }
        }
      }

      this.streamingService.emitComplete(sessionId, taskId, result);
    } catch (error) {
      this.streamingService.emit(sessionId, {
        type: StreamingEventType.ERROR,
        timestamp: Date.now(),
        sessionId,
        taskId,
        error: error instanceof Error ? error.message : String(error),
      });
      this.streamingService.closeSession(sessionId);
    }
  }

  /**
   * Cancel a streaming session
   */
  @Delete('sessions/:sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  cancelSession(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): void {
    const session = this.streamingService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (!this.canAccessSession(user, session)) {
      throw new ForbiddenException('Cross-tenant or cross-user session access denied');
    }
    this.streamingService.cancelSession(sessionId);
  }

  /**
   * Get session status
   */
  @Get('sessions/:sessionId')
  getSessionStatus(
    @Param('sessionId') sessionId: string,
    @CurrentUser() user: JwtPayload,
  ): {
    sessionId: string;
    taskId: string;
    connectedAt: number;
    active: boolean;
  } {
    const session = this.streamingService.getSession(sessionId);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    if (!this.canAccessSession(user, session)) {
      throw new ForbiddenException('Cross-tenant or cross-user session access denied');
    }
    return {
      sessionId: session.sessionId,
      taskId: session.taskId,
      connectedAt: session.connectedAt,
      active: true,
    };
  }

  /**
   * List active sessions (scoped to caller's tenant unless platform role)
   */
  @Get('sessions')
  listSessions(
    @CurrentUser() user: JwtPayload,
  ): {
    sessions: Array<{ sessionId: string; taskId: string; connectedAt: number }>;
  } {
    const isPlatform = PLATFORM_ROLES.includes(user.role);
    const all = this.streamingService.getActiveSessions();
    const filtered = isPlatform
      ? all
      : all.filter((s) => s.tenantId === user.tenantId);
    return {
      sessions: filtered.map((s) => ({
        sessionId: s.sessionId,
        taskId: s.taskId,
        connectedAt: s.connectedAt,
      })),
    };
  }

  /**
   * Get available tools for streaming
   */
  @Get('tools')
  listTools(): {
    tools: Array<{ name: string; description: string; category: string }>;
  } {
    const tools = this.toolRegistry.getToolDefinitions();
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        category: t.category,
      })),
    };
  }

  /**
   * Phase 0 (FIX-002): The single chokepoint for session access checks.
   * Platform roles can access any session. Tenant users can only access
   * their own sessions within their own tenant.
   */
  private canAccessSession(
    user: JwtPayload,
    session: { userId?: string; tenantId?: string },
  ): boolean {
    if (PLATFORM_ROLES.includes(user.role)) return true;
    if (user.tenantId && session.tenantId && user.tenantId !== session.tenantId) {
      return false;
    }
    if (session.userId && session.userId !== user.sub) {
      return false;
    }
    return true;
  }
}
