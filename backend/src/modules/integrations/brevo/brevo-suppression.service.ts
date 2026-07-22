import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type { BrevoSuppressionReason } from '@prisma/client';

export interface SuppressionAggregate {
  total: number;
  byReason: Record<BrevoSuppressionReason, number>;
  byTenant: Array<{ tenantId: string | null; count: number }>;
}

@Injectable()
export class BrevoSuppressionService {
  private readonly logger = new Logger(BrevoSuppressionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Idempotent upsert. First writer wins for (tenantId, email). If a row
   * already exists with a stronger reason, leave it; weaker reasons get
   * overwritten. Rationale: a later SPAM_COMPLAINT shouldn't downgrade an
   * ADMIN_BLOCK.
   *
   * Returns `true` when a new row was inserted, `false` when an existing row
   * was updated.
   */
  async upsert(args: {
    tenantId?: string | null;
    email: string;
    reason: BrevoSuppressionReason;
    addedBy?: string;
    details?: Record<string, unknown>;
    expiresAt?: Date;
  }): Promise<{ created: boolean }> {
    const email = args.email.toLowerCase().trim();
    const tenantId = args.tenantId ?? null;
    const existing = tenantId
      ? await this.prisma.brevoSuppression.findUnique({
          where: { tenantId_email: { tenantId, email } },
        })
      : await this.prisma.brevoSuppression.findFirst({
          where: { tenantId: null, email },
        });
    if (existing) {
      // Stronger-reason heuristic:
      const rank: Record<BrevoSuppressionReason, number> = {
        ADMIN_BLOCK: 5,
        SPAM_COMPLAINT: 4,
        BOUNCE_HARD: 3,
        UNSUBSCRIBE: 2,
        MANUAL: 1,
      };
      if (rank[args.reason] <= rank[existing.reason]) {
        return { created: false };
      }
      await this.prisma.brevoSuppression.update({
        where: { id: existing.id },
        data: {
          reason: args.reason,
          details: (args.details ??
            (existing.details as Prisma.InputJsonValue | null)) as
            | Prisma.InputJsonValue
            | Prisma.JsonNullValueInput,
          addedBy: args.addedBy ?? existing.addedBy,
          expiresAt: args.expiresAt ?? null,
        },
      });
      return { created: false };
    }
    await this.prisma.brevoSuppression.create({
      data: {
        tenantId,
        email,
        reason: args.reason,
        details:
          (args.details as Prisma.InputJsonValue | undefined) ??
          ({} as Prisma.InputJsonValue),
        addedBy: args.addedBy,
        expiresAt: args.expiresAt,
      },
    });
    return { created: true };
  }

  /**
   * Return true if `email` is suppressed for `tenantId` (or platform-wide).
   * Cheap lookup; no caching needed because Prisma hits a covering unique
   * index `(tenantId, email)`.
   */
  async isSuppressed(tenantId: string, email: string): Promise<boolean> {
    const lower = email.toLowerCase().trim();
    const row = await this.prisma.brevoSuppression.findFirst({
      where: {
        email: lower,
        OR: [{ tenantId }, { tenantId: null }],
      },
      select: { id: true },
    });
    return !!row;
  }

  /**
   * Batch form — efficient for sendBatch. Returns the set of emails that
   * should be skipped.
   */
  async filterSuppressed(
    tenantId: string,
    emails: string[],
  ): Promise<Set<string>> {
    if (emails.length === 0) return new Set();
    const lower = emails.map((e) => e.toLowerCase().trim());
    const rows = await this.prisma.brevoSuppression.findMany({
      where: {
        email: { in: lower },
        OR: [{ tenantId }, { tenantId: null }],
      },
      select: { email: true },
    });
    return new Set(rows.map((r) => r.email));
  }

  /** Platform-wide aggregation for the admin dashboard. */
  async aggregate(): Promise<SuppressionAggregate> {
    const [total, byReasonRaw, byTenantRaw] = await Promise.all([
      this.prisma.brevoSuppression.count(),
      this.prisma.brevoSuppression.groupBy({
        by: ['reason'],
        _count: true,
      }),
      this.prisma.brevoSuppression.groupBy({
        by: ['tenantId'],
        _count: true,
        orderBy: { tenantId: 'asc' },
      }),
    ]);
    const byReason: Record<BrevoSuppressionReason, number> = {
      BOUNCE_HARD: 0,
      UNSUBSCRIBE: 0,
      ADMIN_BLOCK: 0,
      SPAM_COMPLAINT: 0,
      MANUAL: 0,
    };
    for (const r of byReasonRaw) byReason[r.reason] = r._count;
    const byTenant = byTenantRaw.map((t) => ({
      tenantId: t.tenantId,
      count: t._count,
    }));
    return { total, byReason, byTenant };
  }

  /**
   * Paginated + filtered listing for the admin UI.
   */
  async list(opts: {
    email?: string;
    reason?: BrevoSuppressionReason;
    tenantId?: string | null;
    limit?: number;
    offset?: number;
  }): Promise<{
    rows: Array<{
      id: string;
      tenantId: string | null;
      email: string;
      reason: BrevoSuppressionReason;
      details: Record<string, unknown>;
      addedBy: string | null;
      expiresAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
    }>;
    total: number;
  }> {
    const where: Record<string, unknown> = {};
    if (opts.email) where['email'] = { contains: opts.email.toLowerCase() };
    if (opts.reason) where['reason'] = opts.reason;
    if (opts.tenantId !== undefined) where['tenantId'] = opts.tenantId;
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 500);
    const offset = Math.max(opts.offset ?? 0, 0);
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.brevoSuppression.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.brevoSuppression.count({ where }),
    ]);
    return { rows, total };
  }

  async remove(id: string): Promise<{ deleted: boolean }> {
    try {
      await this.prisma.brevoSuppression.delete({ where: { id } });
      return { deleted: true };
    } catch {
      return { deleted: false };
    }
  }
}
