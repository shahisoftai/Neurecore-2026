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
 * Two endpoint styles exposed for tenant apps:
 *   - POST /api/v1/chat/messages — used by Command Center Ask AI
 *   - POST /api/v1/ai/chat       — used by core/services/ConversationalAIService
 *
 * Both return the same shape: { reply, conversationId, tokens, model, provider, liveData }.
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
  ) {}

  /** Command Center "Ask AI" entry point */
  @Post('chat/messages')
  @HttpCode(HttpStatus.OK)
  async sendMessage(
    @Body() dto: SendChatMessageDto,
    @Req() req: AuthedRequest,
  ) {
    return this.chat.send(dto, req.user?.tenantId, req.user?.sub);
  }

  /** Core ConversationalAIService entry point */
  @Post('ai/chat')
  @HttpCode(HttpStatus.OK)
  async aiChat(@Body() dto: SendChatMessageDto, @Req() req: AuthedRequest) {
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

  /** Stub history endpoint — keeps existing frontend integration stable */
  @Get('chat/history')
  @HttpCode(HttpStatus.OK)
  async history(@Query('limit') _limit?: string) {
    return { data: [], total: 0 };
  }

  /** Stub clear history endpoint */
  @Delete('chat/history')
  @HttpCode(HttpStatus.NO_CONTENT)
  async clearHistory(): Promise<void> {
    return;
  }

  /** Stub suggestions endpoint (slash commands handled client-side) */
  @Post('chat/suggestions')
  @HttpCode(HttpStatus.OK)
  async suggestions(@Body() _body: { query?: string }) {
    return { suggestions: [] };
  }
}
