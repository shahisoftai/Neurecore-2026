import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/interfaces/token.interface';
import type { Request } from 'express';
import { ThreadService } from '../hermes/services/thread.service';
import type { ParticipantType } from '@prisma/client';

interface AuthedRequest extends Request {
  user?: JwtPayload;
}

interface CreateThreadBody {
  title: string;
  contextType?: string;
  contextId?: string;
  participants: Array<{
    type: ParticipantType;
    id: string;
    role?: string;
  }>;
}

/**
 * ThreadsController — REST surface for CommunicationThread operations.
 *
 * Endpoints:
 *   GET  /api/v1/threads                    — list threads visible to caller
 *   GET  /api/v1/threads/unread/count      — unread count for caller
 *   POST /api/v1/threads                    — create thread
 *   GET  /api/v1/threads/:id               — get thread (participant-only)
 *   GET  /api/v1/threads/:id/messages      — list messages (participant-only)
 *   POST /api/v1/threads/:id/participants  — add participant
 *   POST /api/v1/threads/:id/read          — mark thread read
 *   DELETE /api/v1/threads/:id             — close thread (tenant-scoped)
 */
@Controller({ path: 'threads', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
export class ThreadsController {
  constructor(private readonly threadService: ThreadService) {}

  @Get()
  list(@CurrentUser() _user: JwtPayload) {
    // For now: list threads where the caller (USER) is a participant.
    // Use a tenant-scoped participant query; filter to active.
    return {
      status: 'success',
      data: {
        // Phase 1 minimal surface — expanded in a follow-up.
        // Returning empty list keeps the endpoint contract stable
        // while the inbox UI catches up.
        threads: [] as unknown[],
      },
    };
  }

  @Get('unread/count')
  async unreadCount(@CurrentUser() user: JwtPayload) {
    const count = await this.threadService.getUnreadCount(
      'USER',
      user.sub,
      user.tenantId ?? '',
    );
    return { status: 'success', data: { count } };
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: JwtPayload,
    @Body() body: CreateThreadBody,
    @Req() _req: AuthedRequest,
  ) {
    const tenantId = user.tenantId;
    if (!tenantId) throw new Error('Tenant required');
    // Ensure the caller is in the participants list as USER.
    const hasCaller = body.participants.some(
      (p) => p.type === 'USER' && p.id === user.sub,
    );
    const participants = hasCaller
      ? body.participants
      : [
          ...body.participants,
          { type: 'USER' as ParticipantType, id: user.sub },
        ];
    const thread = await this.threadService.create({
      tenantId,
      title: body.title,
      contextType: body.contextType,
      contextId: body.contextId,
      participants,
    });
    return { status: 'success', data: { thread } };
  }

  @Get(':id')
  async get(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    const thread = await this.threadService.get(id, {
      type: 'USER',
      id: user.sub,
      tenantId: user.tenantId ?? '',
    });
    return { status: 'success', data: { thread } };
  }

  @Get(':id/messages')
  async messages(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const messages = await this.threadService.getMessages(
      id,
      { type: 'USER', id: user.sub, tenantId: user.tenantId ?? '' },
      { limit: limit ? parseInt(limit, 10) : 50, before },
    );
    return { status: 'success', data: { messages } };
  }

  @Post(':id/participants')
  @HttpCode(HttpStatus.OK)
  async addParticipant(
    @Param('id') id: string,
    @CurrentUser() user: JwtPayload,
    @Body() body: { type: ParticipantType; id: string; role?: string },
  ) {
    await this.threadService.addParticipant(id, body, user.tenantId ?? '');
    return { status: 'success', data: { added: true } };
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  async markRead(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.threadService.markRead(id, 'USER', user.sub);
    return { status: 'success', data: { marked: true } };
  }

  @Delete(':id')
  async close(@Param('id') id: string, @CurrentUser() user: JwtPayload) {
    await this.threadService.close(id, user.tenantId ?? '');
    return { status: 'success', data: { closed: true } };
  }
}
