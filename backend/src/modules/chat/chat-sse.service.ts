/**
 * ChatSseService — Server-Sent Events driver for `POST /chat/stream`.
 *
 * Wire format (one event per line, two-line blocks):
 *
 *   event: delta
 *   data: {"text":"Hello! "}
 *
 *   event: delta
 *   data: {"text":"I'm Hermes. "}
 *
 *   event: done
 *   data: {"conversationId":"conv_xxx","tokens":{"input":10,"output":50,"total":60}}
 *
 * Heuristic heartbeat: 20 s between events keeps proxies from closing the
 * connection. Connection is terminated on client disconnect (close listener)
 * or after `done`.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ChatService } from './chat.service';
import type { SendChatMessageDto } from './dto/chat.dto';

const HEARTBEAT_MS = 20_000;

@Injectable()
export class ChatSseService {
  private readonly logger = new Logger(ChatSseService.name);

  constructor(private readonly chat: ChatService) {}

  async stream(
    dto: SendChatMessageDto,
    tenantIdFromJwt: string | undefined,
    res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let closed = false;
    let conversationId = dto.conversationId ?? `conv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const heartbeat = setInterval(() => {
      if (closed) return;
      res.write(': heartbeat\n\n');
    }, HEARTBEAT_MS);

    const onClose = () => {
      closed = true;
      clearInterval(heartbeat);
      try {
        res.end();
      } catch {
        /* ignore */
      }
    };
    res.on('close', onClose);

    const writeEvent = (event: string, data: unknown) => {
      if (closed) return;
      res.write(`event: ${event}\n`);
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    const start = Date.now();
    try {
      for await (const chunk of this.chat.stream(dto, tenantIdFromJwt)) {
        if (closed) break;
        writeEvent('delta', { text: chunk.delta });
        if (chunk.done) {
          writeEvent('done', {
            conversationId,
            tokens: { input: 0, output: 0, total: 0 },
            durationMs: Date.now() - start,
          });
        }
      }
    } catch (err) {
      this.logger.error(`chat SSE failed: ${(err as Error).message}`);
      writeEvent('error', { message: (err as Error).message });
    } finally {
      clearInterval(heartbeat);
      onClose();
    }
  }
}
