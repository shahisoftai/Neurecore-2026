import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { BillingCalculatorService } from '../../finance/services/billing-calculator.service';

export interface SpendingCapResult {
  tenantId: string;
  totalSpentUsd: number;
  softCapUsd: number;
  hardCapUsd: number;
  atSoftCap: boolean;
  atHardCap: boolean;
  blocked: boolean;
}

/**
 * SpendingCapService — Phase 4.5
 *
 * SRP:  Evaluates cumulative spend against soft/hard caps stored in TenantLimit.
 *       Emits structured warnings; callers decide whether to block execution.
 * OCP:  Extend cap sources (e.g. per-agent caps) by adding new quota keys to
 *       TenantLimit.limits without changing this service.
 */
@Injectable()
export class SpendingCapService {
  private readonly logger = new Logger(SpendingCapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly calculator: BillingCalculatorService,
  ) {}

  async evaluate(tenantId: string): Promise<SpendingCapResult> {
    const tenantLimit = await this.prisma.tenantLimit.findUnique({
      where: { tenantId },
    });
    const limits = (tenantLimit?.limits as Record<string, number>) ?? {};

    // Defaults: 0 = unlimited
    const softCapUsd = limits['spending_soft_cap_usd'] ?? 0;
    const hardCapUsd = limits['spending_hard_cap_usd'] ?? 0;

    // Current month spend
    const now = new Date();
    const summary = await this.calculator.calculateMonthly(
      tenantId,
      now.getFullYear(),
      now.getMonth() + 1,
    );
    const totalSpentUsd = summary.grandTotal;

    const atSoftCap = softCapUsd > 0 && totalSpentUsd >= softCapUsd;
    const atHardCap = hardCapUsd > 0 && totalSpentUsd >= hardCapUsd;

    if (atHardCap) {
      this.logger.warn(
        `Hard spending cap reached for tenant ${tenantId}: $${totalSpentUsd} >= $${hardCapUsd}`,
      );
    } else if (atSoftCap) {
      this.logger.warn(
        `Soft spending cap warning for tenant ${tenantId}: $${totalSpentUsd} >= $${softCapUsd}`,
      );
    }

    return {
      tenantId,
      totalSpentUsd,
      softCapUsd,
      hardCapUsd,
      atSoftCap,
      atHardCap,
      blocked: atHardCap,
    };
  }

  async setSoftCap(tenantId: string, amountUsd: number): Promise<void> {
    await this.upsertLimit(tenantId, 'spending_soft_cap_usd', amountUsd);
  }

  async setHardCap(tenantId: string, amountUsd: number): Promise<void> {
    await this.upsertLimit(tenantId, 'spending_hard_cap_usd', amountUsd);
  }

  private async upsertLimit(
    tenantId: string,
    key: string,
    value: number,
  ): Promise<void> {
    const current = await this.prisma.tenantLimit.findUnique({
      where: { tenantId },
    });
    const limits = (current?.limits as Record<string, number>) ?? {};
    limits[key] = value;
    await this.prisma.tenantLimit.upsert({
      where: { tenantId },
      create: { tenantId, limits },
      update: { limits },
    });
  }
}
