import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { SendChatMessageDto } from './dto/chat.dto';
import { ChatService } from './chat.service';
import { ChatSseService } from './chat-sse.service';
import { ChatHistoryService } from './chat-history.service';
import type { Response } from 'express';

interface JwtPayload {
  sub: string;
  tenantId?: string;
  role: string;
}

interface AuthedRequest {
  user: JwtPayload;
}

/**
 * Chat Controller
 *
 * Single canonical chat surface:
 *   - POST /api/v1/chat/messages  — non-streaming query/action reply
 *   - POST /api/v1/chat/stream    — SSE streaming reply
 *   - GET  /api/v1/chat/history   — paginated message history (persisted)
 *   - DELETE /api/v1/chat/history — clear conversation history
 *   - POST /api/v1/chat/suggestions — stub (slash commands handled client-side)
 *
 * Both `/chat/messages` and `/chat/stream` return the same shape:
 * { reply, conversationId, tokens, model, provider, liveData }.
 *
 * The caller's tenantId is taken from the JWT (set by JwtAuthGuard) so the
 * LLM is grounded in real tenant data instead of hallucinating.
 */
@Controller({ version: '1' })
@ApiCommon('chat')
export class ChatController {
  constructor(
    private readonly chat: ChatService,
    private readonly chatSse: ChatSseService,
    private readonly chatHistory: ChatHistoryService,
  ) {}

  /** Command Center "Ask AI" entry point (non-streaming) */
  @Post('chat/messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Body() dto: SendChatMessageDto,
    @Req() req: AuthedRequest,
  ) {
    return this.chat.send(dto, req.user?.tenantId, req.user?.sub);
  }

  /**
   * SSE streaming endpoint — streams AI response tokens as Server-Sent Events.
   * Used by the frontend chat panel for real-time token-by-token rendering.
   *
   * NOTE: This streams the QUERY path only. Action requests (create project, etc.)
   * still route through the non-streaming `send()` → OfficialAgentGraph path.
   */
  @Post('chat/stream')
  async chatStream(
    @Body() dto: SendChatMessageDto,
    @Req() req: AuthedRequest,
    @Res() res: Response,
  ): Promise<void> {
    await this.chatSse.stream(dto, req.user?.tenantId, res);
  }

  /**
   * History endpoint — returns persisted messages for a conversation
   * (or all conversations for the tenant when no conversationId supplied).
   */
  @Get('chat/history')
  @HttpCode(HttpStatus.OK)
  async history(
    @Query('conversationId') conversationId: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { data: [], total: 0 };
    return this.chatHistory.getHistory({
      tenantId,
      userId: req.user?.sub,
      conversationId,
      limit: limit ? Number(limit) : undefined,
    });
  }

  /** Clear history for a conversation (or all messages for the user if no id) */
  @Delete('chat/history')
  @HttpCode(HttpStatus.OK)
  async clearHistory(
    @Query('conversationId') conversationId: string | undefined,
    @Req() req: AuthedRequest,
  ) {
    const tenantId = req.user?.tenantId;
    if (!tenantId) return { deleted: 0 };
    return this.chatHistory.clearHistory({
      tenantId,
      userId: req.user?.sub,
      conversationId,
    });
  }

  /** Stub suggestions endpoint (slash commands handled client-side) */
  @Post('chat/suggestions')
  @HttpCode(HttpStatus.OK)
  async suggestions(@Body() _body: { query?: string }) {
    return { suggestions: [] };
  }
}
