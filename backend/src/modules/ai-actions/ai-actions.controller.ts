/**
 * AIActionsController — Phase 5, EAOS-3 AI Actions HTTP surface.
 *
 * Per `EAOS-implementation-roadmap.md` §9 (Phase 5 tasks 5.3 + 5.4):
 *
 *   POST /api/v1/ai-actions/execute
 *     - Body: ExecuteAIActionDto
 *     - Guards: JwtAuthGuard → RolesGuard → AiActionKillSwitchGuard →
 *               ActionAuthorizationGuard → @Throttle(60/min/user)
 *     - Returns: PENDING/RUNNING invocation row immediately.
 *
 *   GET /api/v1/ai-actions/available?entityType=...
 *     - Returns: AIActionDefinition[] available to the calling user.
 *
 *   GET /api/v1/ai-actions/:invocationId
 *     - Returns: invocation row (polling).
 *
 *   GET /api/v1/ai-actions/:invocationId/stream
 *     - SSE stream of ActionStreamEvent (Phase 5, Task 5.4).
 *
 *   POST /api/v1/ai-actions/:invocationId/cancel
 *     - Best-effort cancel of a streaming invocation.
 */

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '@prisma/client';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { AIActionsService } from './services/ai-actions.service';
import { AiActionKillSwitchGuard } from './guards/ai-action-kill-switch.guard';
import { ActionAuthorizationGuard } from './guards/action-authorization.guard';
import { AiActionMetricsInterceptor } from './interceptors/ai-action-metrics.interceptor';
import { AIActionStreamingService } from './services/ai-action-streaming.service';
import { ExecuteAIActionDto } from './dto/ai-action.dto';
import {
  type ActionStreamEvent,
  ActionStreamEventType,
} from './services/ai-action-streaming.service';

@Controller({ path: 'ai-actions', version: '1' })
@ApiCommon('ai-actions')
@UseInterceptors(AiActionMetricsInterceptor)
export class AIActionsController {
  constructor(
    private readonly aiActions: AIActionsService,
    private readonly streaming: AIActionStreamingService,
  ) {}

  @Get('available')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
    UserRole.SUPPORT,
    UserRole.SECURITY_OFFICER,
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary:
      'List AI Actions the calling user can invoke (for Command Palette + panel pickers)',
  })
  async listAvailable(
    @CurrentUser() user: JwtPayload,
    @Query('entityType') entityType?: string,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    const items = await this.aiActions.listAvailable(user.tenantId, user.sub, entityType);
    return {
      items,
      pagination: {
        page: 1,
        limit: items.length,
        total: items.length,
        totalPages: 1,
      },
    };
  }

  @Post('execute')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
  )
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @UseGuards(
    JwtAuthGuard,
    RolesGuard,
    AiActionKillSwitchGuard,
    ActionAuthorizationGuard,
  )
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({
    summary:
      'Execute an AI Action (full Layer-3 RBAC + tier + credits + rate-limit enforced)',
  })
  async execute(
    @Body() dto: ExecuteAIActionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.aiActions.execute(user.tenantId, user.sub, dto);
  }

  @Get(':invocationId')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Get AI Action invocation status + result' })
  async getInvocation(
    @Param('invocationId', ParseUUIDPipe) invocationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!user.tenantId) throw new Error('Tenant ID required');
    return this.aiActions.getInvocation(user.tenantId, invocationId, user.sub);
  }

  @Get(':invocationId/stream')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
    UserRole.AUDITOR,
  )
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({
    summary: 'SSE stream of an AI Action invocation (Task 5.4)',
  })
  stream(
    @Param('invocationId', ParseUUIDPipe) invocationId: string,
    @CurrentUser() user: JwtPayload,
    @Res() res: Response,
  ): void {
    const role = (user.role as string) ?? 'USER';
    this.aiActions.ensureStreamAccess(invocationId, user.sub, role);

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(
      `data: ${JSON.stringify({
        type: 'connected',
        invocationId,
        timestamp: Date.now(),
      })}\n\n`,
    );

    const obs = this.aiActions.streamFor(invocationId);
    if (!obs) {
      res
        .status(HttpStatus.NOT_FOUND)
        .send(`data: ${JSON.stringify({ error: 'Stream not available' })}\n\n`);
      return;
    }

    const sub = obs.subscribe({
      next: (event: ActionStreamEvent) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
        if (
          event.type === ActionStreamEventType.COMPLETE ||
          event.type === ActionStreamEventType.ERROR ||
          event.type === ActionStreamEventType.CANCELLED
        ) {
          res.end();
        }
      },
      error: (err: Error) => {
        res.write(
          `data: ${JSON.stringify({
            type: 'error',
            invocationId,
            timestamp: Date.now(),
            error: err.message,
          })}\n\n`,
        );
        res.end();
      },
      complete: () => res.end(),
    });

    res.on('close', () => {
      sub.unsubscribe();
    });
  }

  @Post(':invocationId/cancel')
  @Roles(
    UserRole.SUPER_ADMIN,
    UserRole.PLATFORM_ADMIN,
    UserRole.OWNER,
    UserRole.ADMIN,
    UserRole.USER,
  )
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @ApiOperation({ summary: 'Cancel a streaming AI Action invocation' })
  cancel(
    @Param('invocationId', ParseUUIDPipe) invocationId: string,
    @CurrentUser() user: JwtPayload,
  ) {
    const role = (user.role as string) ?? 'USER';
    this.aiActions.ensureStreamAccess(invocationId, user.sub, role);
    this.streaming.cancelSession(invocationId);
    return { status: 'cancelled', invocationId };
  }
}
