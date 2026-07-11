import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { FeatureFlagService } from '../../../common/feature-flag/feature-flag.service';
import { AiGatewayService } from '../../ai-gateway/ai-gateway.service';
import { LLMFactory } from '../../models/services/llm-factory.service';
import {
  THREAD_SERVICE,
  type IThreadService,
} from '../interfaces/IThreadService';
import { HermesSessionService } from './hermes-session.service';

/**
 * ThreadSummarizationService — Phase 9c §16.3.3.
 *
 * Periodic background task that scans CommunicationThread rows for threads
 * exceeding SUMMARIZE_THRESHOLD messages. When `AI_GATEWAY_V2=true`,
 * the summary is produced by `AiGatewayService.invoke` (capability
 * `conversation`) — single source of truth, cost attributed, failover
 * safe. Otherwise the legacy `LLMFactory.invoke` path is used.
 *
 * Rate-limited to MAX_PER_TICK to avoid LLM cost spikes.
 */
@Injectable()
export class ThreadSummarizationService implements OnModuleInit {
  private readonly logger = new Logger(ThreadSummarizationService.name);
  private readonly SUMMARIZE_THRESHOLD = 100;
  private readonly MAX_MESSAGES_TO_SUMMARIZE = 200;
  private readonly TICK_MS = 15 * 60_000; // 15 min
  private readonly MAX_PER_TICK = 5;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(THREAD_SERVICE) private readonly threadService: IThreadService,
    private readonly session: HermesSessionService,
    private readonly llmFactory: LLMFactory,
    @Optional() private readonly featureFlags?: FeatureFlagService,
    @Optional() private readonly aiGateway?: AiGatewayService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        this.logger.warn(`thread summary tick failed: ${String(err)}`),
      );
    }, this.TICK_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const threads = await this.prisma.communicationThread.findMany({
      where: { status: 'ACTIVE' },
      select: {
        id: true,
        tenantId: true,
        _count: {
          select: {
            messages: true,
          },
        },
      },
      take: 100,
    });

    const candidates = threads
      .filter((t) => t._count.messages >= this.SUMMARIZE_THRESHOLD)
      .slice(0, this.MAX_PER_TICK);

    for (const t of candidates) {
      try {
        await this.summarizeThread(t.id, t.tenantId);
      } catch (err) {
        this.logger.warn(`summary for thread ${t.id} failed: ${String(err)}`);
      }
    }
  }

  /** Public entry — also called from tests or admin trigger. */
  async summarizeThread(threadId: string, tenantId: string): Promise<void> {
    const messages = await this.threadService.getMessages(
      threadId,
      { type: 'SYSTEM', id: 'system', tenantId },
      { limit: this.MAX_MESSAGES_TO_SUMMARIZE },
    );
    if (messages.length < this.SUMMARIZE_THRESHOLD) return;

    // Avoid re-summarizing — check if the most recent SYSTEM message is already a summary.
    const latest = await this.prisma.hermesMessage.findFirst({
      where: { threadId, role: 'SYSTEM' },
      orderBy: { createdAt: 'desc' },
      select: { content: true, createdAt: true },
    });
    if (latest && latest.content.startsWith('📋 Thread summary')) {
      const ageMs = Date.now() - latest.createdAt.getTime();
      if (ageMs < this.TICK_MS) return; // just summarized
    }

    const context = messages.map((m) => `[${m.role}] ${m.content}`).join('\n');

    let narrative: string;
    try {
      const prompt = `Summarize the following conversation in 3-5 paragraphs. Include key decisions, action items, and outcomes. Preserve any unresolved questions.\n\n${context}`;
      if (this.featureFlags?.isEnabled('AI_GATEWAY_V2') && this.aiGateway) {
        const r = await this.aiGateway.invoke({
          tenantId,
          capability: 'conversation',
          prompt,
          sourceModule: 'thread-summarization',
          temperature: 0.2,
          maxTokens: 600,
        });
        narrative = r.content;
      } else {
        const result = await this.llmFactory.invoke(prompt, {
          temperature: 0.2,
          maxTokens: 600,
        });
        narrative = result.content;
      }
    } catch (err) {
      this.logger.warn(`invokeSummary failed: ${String(err)}`);
      return;
    }

    const summary = `📋 Thread summary (${messages.length} messages):\n${narrative}`;

    // Need a session to attach the SYSTEM message to. Use a placeholder
    // SYSTEM-thread session so the message can be persisted even though
    // no real Hermes session is active on this thread.
    const placeholder = await this.prisma.hermesSession.findFirst({
      where: { threadId: threadId },
      select: { id: true },
    });
    if (!placeholder) {
      // Create a minimal session row to anchor the SYSTEM message.
      // The thread remains the source of truth for membership; this
      // session is only a parent for the summary message.
      this.logger.warn(
        `Cannot anchor summary message — thread ${threadId} has no session rows`,
      );
      return;
    }

    await this.session.addMessage(
      placeholder.id,
      'SYSTEM',
      summary,
      { source: 'thread-summary' },
      threadId,
    );
  }
}
