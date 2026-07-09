import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export type DeliveryMode = 'realtime' | 'digest' | 'muted';

export interface NotificationPrefRecord {
  id: string;
  tenantId: string;
  userId: string;
  threadId: string | null;
  activityType: string | null;
  minSeverity: string | null;
  deliveryMode: DeliveryMode;
}

@Injectable()
export class NotificationPreferenceService {
  constructor(private readonly prisma: PrismaService) {}

  async getEffective(
    tenantId: string,
    userId: string,
    ctx: { threadId?: string; activityType?: string; severity?: string },
  ): Promise<DeliveryMode> {
    const prefs = await this.prisma.notificationPreference.findMany({
      where: {
        tenantId,
        userId,
        OR: [
          {
            threadId: ctx.threadId ?? null,
            activityType: ctx.activityType ?? null,
          },
          { threadId: ctx.threadId ?? null, activityType: null },
          { threadId: null, activityType: ctx.activityType ?? null },
          { threadId: null, activityType: null },
        ],
      },
      orderBy: [{ threadId: 'desc' }, { activityType: 'desc' }],
    });
    for (const pref of prefs) {
      if (pref.minSeverity && ctx.severity) {
        const order = ['info', 'warn', 'error'];
        const minIdx = order.indexOf(pref.minSeverity);
        const curIdx = order.indexOf(ctx.severity);
        if (curIdx < minIdx) continue;
      }
      return pref.deliveryMode as DeliveryMode;
    }
    return 'realtime';
  }
}
