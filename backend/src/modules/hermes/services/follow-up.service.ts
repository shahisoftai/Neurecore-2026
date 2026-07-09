import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  ACTIVITY_SERVICE,
  type IActivityService,
} from '../interfaces/IActivityService';

@Injectable()
export class FollowUpService implements OnModuleInit {
  private readonly logger = new Logger(FollowUpService.name);
  private readonly REMINDER_AFTER_MS = 24 * 3600 * 1000;
  private readonly INTERVAL_MS = 300_000;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACTIVITY_SERVICE) private readonly activityService: IActivityService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        this.logger.warn(`followup tick failed: ${String(err)}`),
      );
    }, this.INTERVAL_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const threshold = new Date(Date.now() - this.REMINDER_AFTER_MS);
    const threads = await this.prisma.communicationThread.findMany({
      where: { status: 'ACTIVE', updatedAt: { lt: threshold } },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 1 },
        participants: { where: { isActive: true } },
      },
      take: 200,
    });
    for (const thread of threads) {
      const last = thread.messages[0];
      if (!last) continue;
      const nonSystem = thread.participants.find(
        (p) => p.participantType !== 'SYSTEM',
      );
      if (!nonSystem) continue;
      await this.activityService.record({
        tenantId: thread.tenantId,
        actorType: 'SYSTEM',
        actorId: 'follow-up',
        type: 'thread.followup',
        title: `Follow-up needed in "${thread.title}"`,
        threadId: thread.id,
        visibility: 'direct',
        targetParticipantType: nonSystem.participantType,
        targetParticipantId: nonSystem.participantId,
        sourceEventId: `followup:${thread.id}:${Date.now()}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
    }
  }
}
