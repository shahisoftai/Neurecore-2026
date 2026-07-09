import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

/**
 * RetentionJobService — Phase 9e.
 *
 * Nightly cleanup per tenant RetentionPolicy (or defaults if no policy row).
 * Drops ActivityEvents past TTL, archives stale threads, deletes old
 * audit log entries.
 */
@Injectable()
export class RetentionJobService implements OnModuleInit {
  private readonly logger = new Logger(RetentionJobService.name);
  private readonly INTERVAL_MS = 24 * 3600 * 1000;
  private timer: NodeJS.Timeout | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.timer = setInterval(() => {
      this.tick().catch((err) =>
        this.logger.warn(`retention tick failed: ${String(err)}`),
      );
    }, this.INTERVAL_MS);
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<void> {
    const tenants = await this.prisma.tenant.findMany({ select: { id: true } });
    for (const t of tenants) {
      await this.cleanupTenant(t.id);
    }
  }

  private async cleanupTenant(tenantId: string): Promise<void> {
    const policy = await this.prisma.retentionPolicy.findUnique({
      where: { tenantId },
    });
    const activityTtl = policy?.activityEventTtlDays ?? 90;
    const archiveTtl = policy?.threadArchiveTtlDays ?? 365;
    const auditTtl = policy?.auditLogTtlDays ?? 365;
    const inactiveTtl = policy?.threadInactiveTtlDays ?? 90;

    const now = new Date();
    const activityCutoff = new Date(
      now.getTime() - activityTtl * 24 * 3600 * 1000,
    );
    const auditCutoff = new Date(now.getTime() - auditTtl * 24 * 3600 * 1000);
    const inactiveCutoff = new Date(
      now.getTime() - inactiveTtl * 24 * 3600 * 1000,
    );
    const archiveCutoff = new Date(
      now.getTime() - archiveTtl * 24 * 3600 * 1000,
    );

    const [activityDeleted, auditDeleted, archivedThreads, deletedThreads] =
      await Promise.all([
        this.prisma.activityEvent.deleteMany({
          where: { tenantId, expiresAt: { lt: now } },
        }),
        this.prisma.activityEvent.deleteMany({
          where: { tenantId, createdAt: { lt: activityCutoff } },
        }),
        this.prisma.hermesAuditLog.deleteMany({
          where: { tenantId, createdAt: { lt: auditCutoff } },
        }),
        this.prisma.communicationThread.updateMany({
          where: {
            tenantId,
            status: 'ACTIVE',
            updatedAt: { lt: inactiveCutoff },
          },
          data: { status: 'ARCHIVED' },
        }),
        this.prisma.communicationThread.deleteMany({
          where: {
            tenantId,
            status: 'ARCHIVED',
            updatedAt: { lt: archiveCutoff },
          },
        }),
      ]);

    this.logger.log(
      `retention[${tenantId}]: activity=${activityDeleted.count} audit=${auditDeleted.count} archived=${archivedThreads.count} deleted=${deletedThreads.count}`,
    );
  }
}
