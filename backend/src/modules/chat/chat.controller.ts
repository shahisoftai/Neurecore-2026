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
} from '@nestjs/common';
import { ApiCommon } from '../../common/decorators/api-common.decorator';
import { SendChatMessageDto } from './dto/chat.dto';
import { ChatService } from './chat.service';

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
  constructor(private readonly chat: ChatService) {}

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
