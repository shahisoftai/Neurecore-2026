/**
 * RagAskSseService — Server-Sent Events driver for `POST /knowledge/rag-ask/stream`.
 *
 * Phase 6, Task 6.3 (per EAOS-api-contract.md §9.2 — SSE contract).
 *
 * Wire format (one event per line, two-line blocks):
 *
 *   event: start
 *   data: {"citations":[...]}
 *
 *   event: delta
 *   data: {"text":"first word "}
 *
 *   event: delta
 *   data: {"text":"second word"}
 *
 *   event: done
 *   data: {"tokensUsed":{"input":42,"output":128,"total":170},"durationMs":2104}
 *
 * Heuristic heartbeat: 15 s between events keeps proxies from closing the
 * connection. Connection is terminated on client disconnect (close listener)
 * or after `done`.
 */

import { Injectable, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { RAGPipeline } from './rag-pipeline.service';
import type {
  RAGCitation,
  RAGPipelineOptions,
  RAGStreamEvent,
} from '../interfaces/knowledge.interface';

const HEARTBEAT_MS = 15_000;

@Injectable()
export class RagAskSseService {
  private readonly logger = new Logger(RagAskSseService.name);

  constructor(private readonly ragPipeline: RAGPipeline) {}

  async stream(
    tenantId: string,
    question: string,
    options: RAGPipelineOptions | undefined,
    res: Response,
  ): Promise<void> {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    let closed = false;
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
      for await (const ev of this.ragPipeline.stream(tenantId, question, options)) {
        if (closed) break;
        this.mapEvent(ev, writeEvent);
      }
      writeEvent('done', {
        durationMs: Date.now() - start,
      });
    } catch (err) {
      this.logger.error(`rag-ask SSE failed: ${(err as Error).message}`);
      writeEvent('error', { message: (err as Error).message });
    } finally {
      clearInterval(heartbeat);
      onClose();
    }
  }

  private mapEvent(
    ev: RAGStreamEvent,
    write: (event: string, data: unknown) => void,
  ) {
    switch (ev.type) {
      case 'start':
        write('start', { citations: this.toDtoCitations(ev.citations) });
        return;
      case 'delta':
        write('delta', { text: ev.text });
        return;
      case 'done':
        write(
          'done',
          {
            citations: this.toDtoCitations(ev.citations),
            tokensUsed: ev.tokensUsed,
          },
        );
        return;
      case 'error':
        write('error', { message: ev.message });
        return;
    }
  }

  private toDtoCitations(
    citations: RAGCitation[],
  ): Array<{
    knowledgeEntryId: string;
    label: string;
    span: string;
    confidence: number;
    chunkIndex: number;
  }> {
    return citations.map((c) => ({
      knowledgeEntryId: c.knowledgeEntryId,
      label: c.label,
      span: c.span,
      confidence: Number(c.confidence.toFixed(4)),
      chunkIndex: c.chunkIndex,
    }));
  }
}