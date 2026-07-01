import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { ConnectorRegistry } from '../connector.registry';
import { PrismaOAuthTokenStore } from './oauth-token.service';

/**
 * SyncSchedulerService — Phase 4.3
 *
 * SRP:  Runs periodic background syncs for active CRM connectors.
 * OCP:  Sync logic lives in adapters; this service only coordinates timing.
 * DIP:  Depends on ConnectorRegistry + IOAuthTokenStore abstractions, not adapters.
 *
 * NOTE: For production, replace the setInterval below with @nestjs/schedule
 *       cron decorators (add `@nestjs/schedule` + `cron` packages), which
 *       provides distributed locking and missed-run backfill.
 */
@Injectable()
export class SyncSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SyncSchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;

  /** Interval in ms — default 15 min; override via SYNC_INTERVAL_MS env var */
  private readonly intervalMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistry,
    private readonly tokenStore: PrismaOAuthTokenStore,
  ) {
    this.intervalMs = parseInt(process.env.SYNC_INTERVAL_MS ?? '900000', 10);
  }

  onModuleInit(): void {
    // Skip in test environment
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.runAllSyncs(), this.intervalMs);
    this.logger.log(`Sync scheduler started — interval ${this.intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Manually trigger all syncs (e.g. from an admin endpoint) */
  async runAllSyncs(): Promise<{ synced: number; errors: number }> {
    const active = await this.prisma.crmConnector.findMany({
      where: { isActive: true },
    });

    let synced = 0;
    let errors = 0;

    for (const record of active) {
      try {
        const adapter = this.registry.get(record.provider);
        if (!adapter) continue;

        if (!record.tenantId) {
          this.logger.warn(
            `Connector ${record.name} (${record.provider}) has no tenantId — skipping`,
          );
          continue;
        }

        // Idempotent: skip if token is expired (connector must re-authenticate)
        const expired = await this.tokenStore.isExpired(
          record.tenantId,
          record.provider,
        );
        if (expired) {
          this.logger.warn(
            `Token expired for ${record.name} (${record.provider}) — skipping`,
          );
          continue;
        }

        if (adapter.syncContacts) await adapter.syncContacts(record.tenantId);
        if (adapter.syncLeads) await adapter.syncLeads(record.tenantId);
        synced++;
      } catch (err) {
        this.logger.error(
          `Sync failed for ${record.name}: ${(err as Error).message}`,
        );
        errors++;
      }
    }

    this.logger.log(`Sync complete — ${synced} succeeded, ${errors} failed`);
    return { synced, errors };
  }
}
