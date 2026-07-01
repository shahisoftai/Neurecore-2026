import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IQuotaService,
  QuotaCheck,
  QuotaTarget,
} from '../interfaces/IQuotaService';

// Default soft-warning threshold: 80%
const WARNING_THRESHOLD = 0.8;

/**
 * QuotaEvaluatorService — Phase 4.5
 *
 * SRP: read-only evaluations of quota state from DB.
 *      Does NOT enforce or act — that is QuotaEnforcerService's job.
 * OCP: default limits come from TenantLimit.limits JSON; override per-key.
 * DIP: depends on PrismaService injected via NestJS DI.
 */
@Injectable()
export class QuotaEvaluatorService implements IQuotaService {
  constructor(private readonly prisma: PrismaService) {}

  async evaluate(target: QuotaTarget): Promise<QuotaCheck> {
    const { tenantId, quotaKey, period = 'daily', agentId } = target;

    // Resolve limit from TenantLimit.limits JSON or fallback
    const tenantLimit = await this.prisma.tenantLimit.findUnique({
      where: { tenantId },
    });
    const limits = (tenantLimit?.limits as Record<string, number>) ?? {};
    const limit = limits[quotaKey] ?? this.getDefaultLimit(quotaKey);

    const row = await this.prisma.quotaUsage.findFirst({
      where: { tenantId, agentId: agentId ?? null, quotaKey, period },
    });

    // If period has elapsed, treat as zero usage
    const used =
      row && row.resetAt && row.resetAt < new Date() ? 0 : (row?.used ?? 0);

    const remaining = Math.max(0, limit - used);
    const ratio = limit > 0 ? used / limit : 1;

    return {
      allowed: used < limit,
      used,
      limit,
      remaining,
      warningThreshold: WARNING_THRESHOLD,
      atWarning: ratio >= WARNING_THRESHOLD,
    };
  }

  async record(target: QuotaTarget, units = 1): Promise<QuotaCheck> {
    const { tenantId, quotaKey, period = 'daily', agentId } = target;
    const resetAt = this.getResetAt(period);

    // NOTE: agentId is nullable, and PostgreSQL UNIQUE constraints allow multiple NULLs.
    // Use findFirst + update/create. In high contention, consider a DB-side function or
    // a separate table for tenant-only quotas to avoid nullable-unique edge cases.
    const existing = await this.prisma.quotaUsage.findFirst({
      where: { tenantId, agentId: agentId ?? null, quotaKey, period },
      orderBy: { createdAt: 'desc' },
    });

    if (existing) {
      await this.prisma.quotaUsage.update({
        where: { id: existing.id },
        data: { used: { increment: units }, resetAt },
      });
    } else {
      await this.prisma.quotaUsage.create({
        data: {
          tenantId,
          agentId: agentId ?? null,
          quotaKey,
          period,
          used: units,
          limit: 0,
          resetAt,
        },
      });
    }

    return this.evaluate(target);
  }

  async reset(target: QuotaTarget): Promise<void> {
    const { tenantId, quotaKey, period = 'daily', agentId } = target;
    await this.prisma.quotaUsage.updateMany({
      where: { tenantId, agentId: agentId ?? null, quotaKey, period },
      data: { used: 0, resetAt: this.getResetAt(period) },
    });
  }

  async setLimit(target: QuotaTarget, limit: number): Promise<void> {
    const { tenantId, quotaKey } = target;
    const current = await this.prisma.tenantLimit.findUnique({
      where: { tenantId },
    });
    const limits = (current?.limits as Record<string, number>) ?? {};
    limits[quotaKey] = limit;
    await this.prisma.tenantLimit.upsert({
      where: { tenantId },
      create: { tenantId, limits },
      update: { limits },
    });
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private getDefaultLimit(quotaKey: string): number {
    const DEFAULTS: Record<string, number> = {
      agent_executions: 1000,
      api_calls_per_day: 10000,
      model_scoring: 500,
      connector_syncs: 100,
      invoices_per_month: 200,
    };
    return DEFAULTS[quotaKey] ?? 1000;
  }

  private getResetAt(period: string): Date {
    const now = new Date();
    switch (period) {
      case 'hourly':
        return new Date(
          now.getFullYear(),
          now.getMonth(),
          now.getDate(),
          now.getHours() + 1,
        );
      case 'daily':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case 'monthly':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
      case 'lifetime':
      default:
        return new Date('9999-12-31');
    }
  }
}
