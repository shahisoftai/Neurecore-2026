import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const DAILY_LIMIT = 300;
const WARNING_THRESHOLD = 240;

@Injectable()
export class BrevoUsageService {
  private readonly logger = new Logger(BrevoUsageService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  private todayUtc(): Date {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  }

  async recordSend(tenantId: string): Promise<void> {
    const date = this.todayUtc();
    await this.prisma.brevoUsageCounter.upsert({
      where: { tenantId_date: { tenantId, date } },
      create: { tenantId, date, sentCount: 1 },
      update: { sentCount: { increment: 1 } },
    });
  }

  async getTodayCount(tenantId: string): Promise<number> {
    const date = this.todayUtc();
    const row = await this.prisma.brevoUsageCounter.findUnique({
      where: { tenantId_date: { tenantId, date } },
    });
    return row?.sentCount ?? 0;
  }

  async checkLimit(tenantId: string): Promise<void> {
    const count = await this.getTodayCount(tenantId);
    if (count >= DAILY_LIMIT) {
      throw new BadRequestException(
        `Brevo daily limit reached (${count}/${DAILY_LIMIT}). Upgrade plan or wait until tomorrow (UTC).`,
      );
    }
  }

  async getStatus(tenantId: string) {
    const count = await this.getTodayCount(tenantId);
    return {
      sentToday: count,
      dailyLimit: DAILY_LIMIT,
      warningThreshold: WARNING_THRESHOLD,
      isAtWarning: count >= WARNING_THRESHOLD && count < DAILY_LIMIT,
      isAtLimit: count >= DAILY_LIMIT,
      remaining: Math.max(0, DAILY_LIMIT - count),
    };
  }
}
