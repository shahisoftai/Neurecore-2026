import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PrismaIntegrationCredentialStore } from '../services/integration-credential.store';
import { BrevoEmailService } from './brevo-email.service';
import { BrevoSuppressionService } from './brevo-suppression.service';

export interface TenantBrevoAdminRow {
  tenantId: string;
  tenantName: string;
  status: 'CONNECTED' | 'MASTER' | 'NOT_CONNECTED';
  source: 'tenant' | 'master' | 'none';
  brevoSenderEmail: string | null;
  brevoSenderName: string | null;
  brevoReplyToEmail: string | null;
  hasMasterKey: boolean;
  sentToday: number;
  dailyLimit: number;
  remainingToday: number;
  isAtWarning: boolean;
  isAtLimit: boolean;
  credentialCreatedAt: Date | null;
  credentialLastUpdatedAt: Date | null;
}

export interface PlatformBrevoStats {
  totalTenants: number;
  tenantsConnected: number;
  tenantsUsingMasterKey: number;
  tenantsNotRouted: number;
  totalSentToday: number;
  totalSentLast30Days: number;
  globalDailyLimit: number;
  masterKeyConfigured: boolean;
  webhookSecretConfigured: boolean;
  globalFromAddress: string;
  globalFromName: string;
  globalReplyTo: string | null;
  tenantLimits: Record<string, number>;
  suppressions: {
    total: number;
    byReason: {
      BOUNCE_HARD: number;
      UNSUBSCRIBE: number;
      ADMIN_BLOCK: number;
      SPAM_COMPLAINT: number;
      MANUAL: number;
    };
  };
}

@Injectable()
export class AdminBrevoService {
  private readonly logger = new Logger(AdminBrevoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly credentials: PrismaIntegrationCredentialStore,
    private readonly emailService: BrevoEmailService,
    private readonly config: ConfigService,
    private readonly suppressions: BrevoSuppressionService,
  ) {}

  /**
   * Returns a per-tenant roll-up of Brevo state for the admin dashboard.
   *
   *   status = CONNECTED       → tenant has its own IntegrationCredential
   *   status = MASTER          → no tenant credential, falling back to BREVO_MASTER_API_KEY
   *   status = NOT_CONNECTED   → no tenant credential AND no master key
   */
  async listTenantRows(): Promise<TenantBrevoAdminRow[]> {
    const tenants = await this.prisma.tenant.findMany({
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    });

    const creds = await this.prisma.integrationCredential.findMany({
      where: { provider: IntegrationProvider.BREVO },
    });

    const today = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      ),
    );

    const usageRows = await this.prisma.brevoUsageCounter.findMany({
      where: { date: today },
      select: { tenantId: true, sentCount: true },
    });
    const usageMap = new Map<string, number>(
      usageRows.map((u) => [u.tenantId, u.sentCount]),
    );

    const senderRows = await this.prisma.tenant.findMany({
      select: {
        id: true,
        brevoSenderEmail: true,
        brevoSenderName: true,
        brevoReplyToEmail: true,
      },
    });
    const senderMap = new Map(
      senderRows.map((s) => [
        s.id,
        {
          brevoSenderEmail: s.brevoSenderEmail,
          brevoSenderName: s.brevoSenderName,
          brevoReplyToEmail: s.brevoReplyToEmail,
        },
      ]),
    );

    const masterKey = this.config.get<string>('BREVO_MASTER_API_KEY');
    const hasMasterKey = Boolean(masterKey && masterKey.length > 0);
    const dailyLimit = this.config.get<number>('BREVO_DAILY_LIMIT') || 300;
    const warningThreshold = 240;

    const rows: TenantBrevoAdminRow[] = tenants.map((t) => {
      const cred = creds.find((c) => c.tenantId === t.id);
      const sentToday = usageMap.get(t.id) ?? 0;
      const remainingToday = Math.max(0, dailyLimit - sentToday);
      const sender = senderMap.get(t.id);
      let status: TenantBrevoAdminRow['status'];
      let source: TenantBrevoAdminRow['source'];
      if (cred) {
        status = 'CONNECTED';
        source = 'tenant';
      } else if (hasMasterKey) {
        status = 'MASTER';
        source = 'master';
      } else {
        status = 'NOT_CONNECTED';
        source = 'none';
      }
      return {
        tenantId: t.id,
        tenantName: t.name,
        status,
        source,
        brevoSenderEmail: sender?.brevoSenderEmail ?? null,
        brevoSenderName: sender?.brevoSenderName ?? null,
        brevoReplyToEmail: sender?.brevoReplyToEmail ?? null,
        hasMasterKey,
        sentToday,
        dailyLimit,
        remainingToday,
        isAtWarning: sentToday >= warningThreshold && sentToday < dailyLimit,
        isAtLimit: sentToday >= dailyLimit,
        credentialCreatedAt: cred?.createdAt ?? null,
        credentialLastUpdatedAt: cred?.updatedAt ?? null,
      };
    });
    return rows;
  }

  async platformStats(): Promise<PlatformBrevoStats> {
    const rows = await this.listTenantRows();
    const totalSentToday = rows.reduce((s, r) => s + r.sentToday, 0);
    const totalSentLast30Days = await this.last30DaysTotal();
    const tenantsConnected = rows.filter(
      (r) => r.status === 'CONNECTED',
    ).length;
    const tenantsUsingMasterKey = rows.filter(
      (r) => r.status === 'MASTER',
    ).length;
    const tenantsNotRouted = rows.filter(
      (r) => r.status === 'NOT_CONNECTED',
    ).length;

    const masterKey = this.config.get<string>('BREVO_MASTER_API_KEY');
    const masterKeyConfigured = Boolean(masterKey && masterKey.length > 0);
    const webhookSecret =
      this.config.get<string>('BREVO_WEBHOOK_SECRET') ||
      this.config.get<string>('BREVO_WEBHOOK_SIGNING_SECRET');
    const webhookSecretConfigured = Boolean(
      webhookSecret && webhookSecret.length > 0,
    );

    // Per-tenant daily limits (currently all share; field exists for tiered override)
    const tenantLimits: Record<string, number> = {};
    for (const r of rows) tenantLimits[r.tenantId] = r.dailyLimit;

    const suppressionAggregate = await this.suppressions.aggregate();

    return {
      totalTenants: rows.length,
      tenantsConnected,
      tenantsUsingMasterKey,
      tenantsNotRouted,
      totalSentToday,
      totalSentLast30Days,
      globalDailyLimit: this.config.get<number>('BREVO_DAILY_LIMIT') || 300,
      masterKeyConfigured,
      webhookSecretConfigured,
      globalFromAddress: this.config.get<string>('EMAIL_FROM_ADDRESS') || '',
      globalFromName: this.config.get<string>('EMAIL_FROM_NAME') || 'NeureCore',
      globalReplyTo: this.config.get<string>('EMAIL_REPLY_TO') || null,
      tenantLimits,
      suppressions: {
        total: suppressionAggregate.total,
        byReason: suppressionAggregate.byReason,
      },
    };
  }

  /**
   * 30-day send-count series, one row per UTC day. Used by the dashboard
   * sparkline / area chart.
   */
  async usageSeries(): Promise<
    Array<{ date: string; total: number; byTenant: Record<string, number> }>
  > {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 29); // last 30 days inclusive

    const rows = await this.prisma.brevoUsageCounter.findMany({
      where: { date: { gte: start } },
      orderBy: { date: 'asc' },
      select: { tenantId: true, date: true, sentCount: true },
    });

    const byDay = new Map<
      string,
      { total: number; byTenant: Record<string, number> }
    >();
    for (const r of rows) {
      const key = r.date.toISOString().slice(0, 10);
      const entry = byDay.get(key) ?? { total: 0, byTenant: {} };
      entry.total += r.sentCount;
      entry.byTenant[r.tenantId] =
        (entry.byTenant[r.tenantId] ?? 0) + r.sentCount;
      byDay.set(key, entry);
    }

    const out: Array<{
      date: string;
      total: number;
      byTenant: Record<string, number>;
    }> = [];
    for (let i = 0; i < 30; i += 1) {
      const d = new Date(start);
      d.setUTCDate(start.getUTCDate() + i);
      const key = d.toISOString().slice(0, 10);
      const e = byDay.get(key) ?? { total: 0, byTenant: {} };
      out.push({ date: key, total: e.total, byTenant: e.byTenant });
    }
    return out;
  }

  /**
   * Force-disconnect a tenant's Brevo integration and clear any
   * per-tenant sender identity. Master-key routing still applies
   * after disconnect if `BREVO_MASTER_API_KEY` is set.
   */
  async disconnectTenant(tenantId: string): Promise<{
    tenantId: string;
    revoked: true;
    hadCredential: boolean;
    hadSenderIdentity: boolean;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new BadRequestException(`Tenant not found: ${tenantId}`);
    }
    const hadCredential = await this.credentials.exists(
      tenantId,
      IntegrationProvider.BREVO,
    );
    await this.credentials
      .delete(tenantId, IntegrationProvider.BREVO)
      .catch(() => null);
    this.emailService.invalidate(tenantId);

    const senderFields = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { brevoSenderEmail: true },
    });
    const hadSenderIdentity = !!senderFields?.brevoSenderEmail;
    if (hadSenderIdentity) {
      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          brevoSenderEmail: null,
          brevoSenderName: null,
          brevoReplyToEmail: null,
        },
      });
      this.emailService.invalidateIdentity(tenantId);
    }
    return { tenantId, revoked: true, hadCredential, hadSenderIdentity };
  }

  /**
   * Reset today's per-tenant quota counter to 0. Use after a runaway agent
   * burned through the limit, or to clear an erroneously-incremented row.
   */
  async resetTodayQuota(tenantId: string): Promise<{
    tenantId: string;
    reset: boolean;
    previousCount: number;
  }> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true },
    });
    if (!tenant) {
      throw new BadRequestException(`Tenant not found: ${tenantId}`);
    }
    const today = new Date(
      Date.UTC(
        new Date().getUTCFullYear(),
        new Date().getUTCMonth(),
        new Date().getUTCDate(),
      ),
    );
    const existing = await this.prisma.brevoUsageCounter.findUnique({
      where: { tenantId_date: { tenantId, date: today } },
    });
    if (!existing) {
      return { tenantId, reset: false, previousCount: 0 };
    }
    await this.prisma.brevoUsageCounter.delete({
      where: { tenantId_date: { tenantId, date: today } },
    });
    return {
      tenantId,
      reset: true,
      previousCount: existing.sentCount,
    };
  }

  /**
   * Cross-tenant webhook event query. Supports filtering by tenant,
   * event type, messageId, and date range.
   */
  async listEvents(opts: {
    tenantId?: string;
    eventType?: string;
    messageId?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<{
    rows: Array<{
      id: string;
      tenantId: string | null;
      eventType: string;
      email: string;
      messageId: string | null;
      occurredAt: Date;
      receivedAt: Date;
      payload: unknown;
    }>;
    total: number;
  }> {
    const where: Record<string, unknown> = {};
    if (opts.tenantId) where['tenantId'] = opts.tenantId;
    if (opts.eventType) where['eventType'] = opts.eventType;
    if (opts.messageId) where['messageId'] = opts.messageId;
    if (opts.from || opts.to) {
      const range: Record<string, Date> = {};
      if (opts.from) range.gte = opts.from;
      if (opts.to) range.lt = opts.to;
      where['receivedAt'] = range;
    }
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
    const offset = Math.max(opts.offset ?? 0, 0);

    const [rows, total] = await this.prisma.$transaction([
      this.prisma.brevoWebhookEvent.findMany({
        where,
        orderBy: { receivedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.brevoWebhookEvent.count({ where }),
    ]);
    return { rows, total };
  }

  /**
   * Probe the Brevo account API using the master key. Returns:
   *   - account: { email, plan, ... } when key works
   *   - error: human-readable message on failure
   */
  async healthCheck(): Promise<{
    ok: boolean;
    source: 'master' | 'tenant' | 'none';
    account?: Record<string, unknown>;
    error?: string;
    webhook: { secretConfigured: boolean; endpoint: string };
    fetchedAt: string;
  }> {
    const masterKey = this.config.get<string>('BREVO_MASTER_API_KEY');
    const webhookSecret =
      this.config.get<string>('BREVO_WEBHOOK_SECRET') ||
      this.config.get<string>('BREVO_WEBHOOK_SIGNING_SECRET');
    const endpoint = `${this.config.get<string>('BREVO_API_BASE_URL') || 'https://api.brevo.com/v3'}/account`;

    if (!masterKey) {
      return {
        ok: false,
        source: 'none',
        webhook: {
          secretConfigured: Boolean(webhookSecret),
          endpoint: '/api/v1/integrations/brevo/webhook',
        },
        error: 'BREVO_MASTER_API_KEY not configured',
        fetchedAt: new Date().toISOString(),
      };
    }

    try {
      const res = await fetch(endpoint, {
        headers: { 'api-key': masterKey, Accept: 'application/json' },
      });
      if (!res.ok) {
        return {
          ok: false,
          source: 'master',
          webhook: {
            secretConfigured: Boolean(webhookSecret),
            endpoint: '/api/v1/integrations/brevo/webhook',
          },
          error: `Brevo HTTP ${res.status}`,
          fetchedAt: new Date().toISOString(),
        };
      }
      const account = (await res.json()) as Record<string, unknown>;
      return {
        ok: true,
        source: 'master',
        account,
        webhook: {
          secretConfigured: Boolean(webhookSecret),
          endpoint: '/api/v1/integrations/brevo/webhook',
        },
        fetchedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        ok: false,
        source: 'master',
        webhook: {
          secretConfigured: Boolean(webhookSecret),
          endpoint: '/api/v1/integrations/brevo/webhook',
        },
        error: (err as Error).message,
        fetchedAt: new Date().toISOString(),
      };
    }
  }

  private async last30DaysTotal(): Promise<number> {
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    start.setUTCDate(start.getUTCDate() - 29);
    const agg = await this.prisma.brevoUsageCounter.aggregate({
      where: { date: { gte: start } },
      _sum: { sentCount: true },
    });
    return agg._sum.sentCount ?? 0;
  }
}
