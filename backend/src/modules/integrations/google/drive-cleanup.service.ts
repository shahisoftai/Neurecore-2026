import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { GoogleDriveService } from './google-drive.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { NotificationType } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_INTERVAL_MS = 24 * 60 * 60 * 1000;
const NOTIFICATION_LEAD_DAYS = 7;

@Injectable()
export class DriveCleanupService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DriveCleanupService.name);
  private timer?: ReturnType<typeof setInterval>;

  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly drive: GoogleDriveService,
    private readonly notifications: NotificationsService,
  ) {
    this.intervalMs = parseInt(
      process.env.DRIVE_CLEANUP_INTERVAL_MS ?? String(DEFAULT_INTERVAL_MS),
      10,
    );
  }

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.runCleanup(), this.intervalMs);
    this.logger.log(
      `Drive cleanup scheduler started — interval ${this.intervalMs}ms`,
    );
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /**
   * WS-6.2: Clean up Drive folders for TERMINATED agents older than each tenant's
   * retentionDays (default 90). ARCHIVED agents are preserved (soft-delete audit policy).
   *
   * Phase 1 (notification): emit a tenant-admin notification 7 days before deletion.
   * Phase 2 (deletion):     only deletes empty folders; non-empty folders are skipped
   *                          with a warning log so manual review is possible.
   */
  async runCleanup(): Promise<{
    notified: number;
    deleted: number;
    skipped: number;
  }> {
    const result = { notified: 0, deleted: 0, skipped: 0 };

    const tenants = await this.prisma.tenant.findMany({
      where: { googleDriveRootFolderId: { not: null } },
      select: { id: true, retentionDays: true },
    });

    for (const tenant of tenants) {
      const retentionMs = (tenant.retentionDays ?? 90) * DAY_MS;
      const cutoff = new Date(Date.now() - retentionMs);
      const deletionCutoff = new Date(
        Date.now() - (tenant.retentionDays - NOTIFICATION_LEAD_DAYS) * DAY_MS,
      );

      const candidates = await this.prisma.agent.findMany({
        where: {
          tenantId: tenant.id,
          status: 'TERMINATED',
          googleDriveFolderId: { not: null },
          updatedAt: { lt: cutoff },
        },
        select: {
          id: true,
          name: true,
          googleDriveFolderId: true,
          updatedAt: true,
        },
      });

      for (const agent of candidates) {
        if (!agent.googleDriveFolderId) continue;

        if (agent.updatedAt > deletionCutoff) {
          // Notify (once) — at this point agent is within 7 days of deletion
          const alreadyNotified = await this.prisma.notification.findFirst({
            where: {
              tenantId: tenant.id,
              type: NotificationType.WARNING,
              payload: {
                path: ['driveCleanupAgentId'],
                equals: agent.id,
              } as never,
            },
          });
          if (!alreadyNotified) {
            const tenantUsers = await this.prisma.user.findMany({
              where: { tenantId: tenant.id, isActive: true },
              select: { id: true },
              take: 1,
            });
            for (const u of tenantUsers) {
              await this.notifications.create({
                tenantId: tenant.id,
                userId: u.id,
                type: NotificationType.WARNING,
                title: `Drive folder for "${agent.name}" will be deleted in ${NOTIFICATION_LEAD_DAYS} days`,
                message: `The terminated agent "${agent.name}" has no activity for ${tenant.retentionDays} days. Its Drive folder will be deleted automatically unless the agent is restored.`,
                payload: { driveCleanupAgentId: agent.id } as never,
              });
            }
            result.notified++;
          }
          continue;
        }

        try {
          const folderId = agent.googleDriveFolderId;
          if (!folderId) continue;
          const children = await this.drive.listFiles(tenant.id, folderId, {
            pageSize: 100,
          });
          if (children.length > 0) {
            this.logger.warn(
              `Skipping non-empty Drive folder for terminated agent ${agent.id} (${agent.name}); ${children.length} items`,
            );
            result.skipped++;
            continue;
          }
          await this.drive.deleteFile(tenant.id, folderId);
          await this.prisma.agent.update({
            where: { id: agent.id },
            data: { googleDriveFolderId: null },
          });
          this.logger.log(
            `Deleted Drive folder for terminated agent ${agent.id}`,
          );
          result.deleted++;
        } catch (err) {
          this.logger.error(
            `Failed to delete Drive folder for agent ${agent.id}`,
            err instanceof Error ? err.stack : String(err),
          );
          result.skipped++;
        }
      }
    }

    this.logger.log(
      `Drive cleanup finished — notified=${result.notified} deleted=${result.deleted} skipped=${result.skipped}`,
    );
    return result;
  }
}
