import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IBillingCalculator,
  BillingSummary,
} from '../interfaces/finance.interfaces';
import { ExpenseCategory, Expense } from '@prisma/client';

/**
 * BillingCalculatorService — Phase 4.4
 *
 * SRP:  Aggregates expenses into a billing summary for a time range.
 *       Does NOT create invoices — that belongs to InvoiceService.
 * DIP:  Depends on PrismaService injected by NestJS.
 */
@Injectable()
export class BillingCalculatorService implements IBillingCalculator {
  constructor(private readonly prisma: PrismaService) {}

  async calculateMonthly(
    tenantId: string,
    year: number,
    month: number,
  ): Promise<BillingSummary> {
    const from = new Date(year, month - 1, 1);
    const to = new Date(year, month, 0, 23, 59, 59, 999); // last ms of month
    return this.calculatePeriod(tenantId, from, to);
  }

  async calculatePeriod(
    tenantId: string,
    from: Date,
    to: Date,
  ): Promise<BillingSummary> {
    const expenses = await this.prisma.expense.findMany({
      where: { tenantId, recordedAt: { gte: from, lte: to } },
    });

    const byCategory = (cat: ExpenseCategory) =>
      expenses
        .filter((e) => e.category === cat)
        .reduce((s, e) => s + Number(e.amountUsd), 0);

    const totalAgentExecutionCost = byCategory(ExpenseCategory.AGENT_EXECUTION);
    const totalToolUsageCost = byCategory(ExpenseCategory.TOOL_USAGE);
    const totalApiCost =
      byCategory(ExpenseCategory.API_CALL) +
      byCategory(ExpenseCategory.MODEL_INFERENCE);
    const grandTotal = expenses.reduce((s, e) => s + Number(e.amountUsd), 0);

    return {
      tenantId,
      periodStart: from,
      periodEnd: to,
      totalAgentExecutionCost,
      totalToolUsageCost,
      totalApiCost,
      grandTotal,
      currency: 'USD',
    };
  }

  async recordExpense(
    tenantId: string,
    category: string,
    description: string,
    amountUsd: number,
    opts: {
      agentId?: string;
      invoiceId?: string;
      currency?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): Promise<Expense> {
    return this.prisma.expense.create({
      data: {
        tenantId,
        category: category as ExpenseCategory,
        description,
        amountUsd,
        currency: opts.currency ?? 'USD',
        agentId: opts.agentId ?? null,
        invoiceId: opts.invoiceId ?? null,
        metadata: (opts.metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async listExpenses(
    tenantId: string,
    page = 1,
    limit = 50,
  ): Promise<{
    data: Expense[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    const data = await this.prisma.expense.findMany({
      where: { tenantId },
      skip,
      take: limit,
      orderBy: { recordedAt: 'desc' },
    });
    const total = await this.prisma.expense.count({ where: { tenantId } });
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
