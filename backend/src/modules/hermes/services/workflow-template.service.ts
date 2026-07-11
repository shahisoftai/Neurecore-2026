import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  THREAD_SERVICE,
  type IThreadService,
} from '../interfaces/IThreadService';
import {
  ACTIVITY_SERVICE,
  type IActivityService,
} from '../interfaces/IActivityService';

@Injectable()
export class WorkflowTemplateService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowTemplateService.name);
  private readonly TICK_MS = 60_000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(THREAD_SERVICE) private readonly threadService: IThreadService,
    @Inject(ACTIVITY_SERVICE)
    private readonly activityService: IActivityService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        this.logger.warn(`workflow tick failed: ${String(err)}`),
      );
    }, this.TICK_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const now = new Date();
    const due = await this.prisma.workflowTemplate.findMany({
      where: {
        isActive: true,
        OR: [{ nextRunAt: { lte: now } }, { nextRunAt: null }],
      },
      take: 50,
    });
    for (const tmpl of due) {
      try {
        await this.runTemplate(tmpl);
      } catch (err) {
        this.logger.warn(`template ${tmpl.id} failed: ${String(err)}`);
      }
    }
  }

  private async runTemplate(tmpl: {
    id: string;
    tenantId: string;
    threadTitle: string;
    participantIds: unknown;
    contextType: string | null;
    contextId: string | null;
    firstMessageContent: string | null;
    cron: string;
    timezone: string;
    lastRunAt: Date | null;
  }) {
    const participantsRaw = tmpl.participantIds;
    const participants = Array.isArray(participantsRaw)
      ? (participantsRaw as Array<{ type: string; id: string; role?: string }>)
      : [];

    const thread = await this.threadService.create({
      tenantId: tmpl.tenantId,
      title: tmpl.threadTitle,
      contextType: tmpl.contextType ?? undefined,
      contextId: tmpl.contextId ?? undefined,
      participants: participants
        .filter(
          (p) => p && typeof p.type === 'string' && typeof p.id === 'string',
        )
        .map((p) => ({
          type: p.type as
            | 'USER'
            | 'AI_AGENT'
            | 'SYSTEM'
            | 'WORKFLOW'
            | 'EXTERNAL',
          id: p.id,
          role: p.role,
        })),
    });

    if (tmpl.firstMessageContent) {
      await this.activityService.record({
        tenantId: tmpl.tenantId,
        actorType: 'SYSTEM',
        actorId: 'workflow-template',
        type: 'workflow:template_posted',
        title: tmpl.firstMessageContent.slice(0, 80),
        threadId: thread.id,
        contextType: tmpl.contextType ?? undefined,
        contextId: tmpl.contextId ?? undefined,
        payload: { templateId: tmpl.id, content: tmpl.firstMessageContent },
        sourceEventId: `template:${tmpl.id}:${Date.now()}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }

    const next = this.computeNextRun(tmpl.cron);
    await this.prisma.workflowTemplate.update({
      where: { id: tmpl.id },
      data: { lastRunAt: new Date(), nextRunAt: next },
    });
  }

  private computeNextRun(cron: string): Date {
    // Minimal cron support: only handles "every N minutes" pattern.
    // For production use, replace with cron-parser; here we just
    // schedule +N minutes for safety.
    const every = cron.match(/^\*\/(\d+)\s+\*\s+\*\s+\*\s+\*$/);
    if (every) {
      const n = parseInt(every[1], 10);
      return new Date(Date.now() + n * 60_000);
    }
    return new Date(Date.now() + 24 * 3600 * 1000);
  }
}
