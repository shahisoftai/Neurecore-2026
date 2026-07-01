/**
 * Budget Policy Repository - Prisma Implementation
 *
 * Implements IBudgetPolicyRepository following SOLID principles
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import type {
  IBudgetPolicyRepository,
  IBudgetIncidentRepository,
  CreateBudgetPolicyInput,
  UpdateBudgetPolicyInput,
  CreateBudgetIncidentInput,
} from '../interfaces/cost.interface';
import type { BudgetPolicy, BudgetIncident, Prisma } from '@prisma/client';

@Injectable()
export class PrismaBudgetPolicyRepository implements IBudgetPolicyRepository {
  private readonly logger = new Logger(PrismaBudgetPolicyRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findByTenant(tenantId: string): Promise<BudgetPolicy[]> {
    return this.prisma.budgetPolicy.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByScope(
    tenantId: string,
    scope: 'TENANT' | 'DEPARTMENT' | 'AGENT' | 'MODEL',
    scopeId?: string,
  ): Promise<BudgetPolicy[]> {
    const where: Prisma.BudgetPolicyWhereInput = {
      tenantId,
      scope,
    };

    if (scope === 'DEPARTMENT' && scopeId) {
      where.departmentId = scopeId;
    } else if (scope === 'AGENT' && scopeId) {
      where.agentId = scopeId;
    } else if (scope === 'MODEL' && scopeId) {
      where.modelPattern = scopeId;
    }

    return this.prisma.budgetPolicy.findMany({
      where,
    });
  }

  async findActivePolicies(tenantId: string): Promise<BudgetPolicy[]> {
    return this.prisma.budgetPolicy.findMany({
      where: {
        tenantId,
        enabled: true,
        resetAt: { gte: new Date() },
      },
    });
  }

  async create(input: CreateBudgetPolicyInput): Promise<BudgetPolicy> {
    // Calculate reset date based on period
    const resetAt = this.calculateResetDate(input.period);

    return this.prisma.budgetPolicy.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        limitCents: input.limitCents,
        period: input.period,
        scope: input.scope,
        departmentId: input.scope === 'DEPARTMENT' ? input.scopeId : null,
        agentId: input.scope === 'AGENT' ? input.scopeId : null,
        modelPattern: input.scope === 'MODEL' ? input.scopeId : null,
        alertThresholds: input.alertThresholds ?? [50, 75, 90],
        action: input.action ?? 'ALERT',
        enabled: input.enabled ?? true,
        resetAt,
      },
    });
  }

  async update(
    id: string,
    input: UpdateBudgetPolicyInput,
  ): Promise<BudgetPolicy> {
    const updateData: Prisma.BudgetPolicyUpdateInput = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.limitCents !== undefined)
      updateData.limitCents = input.limitCents;
    if (input.alertThresholds !== undefined)
      updateData.alertThresholds = input.alertThresholds;
    if (input.action !== undefined) updateData.action = input.action;

    return this.prisma.budgetPolicy.update({
      where: { id },
      data: updateData,
    });
  }

  async updateSpend(id: string, currentSpendCents: number): Promise<void> {
    await this.prisma.budgetPolicy.update({
      where: { id },
      data: { currentSpendCents },
    });
  }

  async delete(id: string): Promise<void> {
    await this.prisma.budgetPolicy.delete({
      where: { id },
    });
  }

  private calculateResetDate(period: 'DAILY' | 'WEEKLY' | 'MONTHLY'): Date {
    const now = new Date();
    switch (period) {
      case 'DAILY':
        return new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      case 'WEEKLY': {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
        return nextWeek;
      }
      case 'MONTHLY':
        return new Date(now.getFullYear(), now.getMonth() + 1, 1);
    }
  }
}

@Injectable()
export class PrismaBudgetIncidentRepository implements IBudgetIncidentRepository {
  private readonly logger = new Logger(PrismaBudgetIncidentRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateBudgetIncidentInput): Promise<BudgetIncident> {
    return this.prisma.budgetIncident.create({
      data: {
        budgetPolicyId: input.budgetPolicyId,
        threshold: input.threshold,
        totalCents: input.totalCents,
        status: 'ACTIVE',
      },
    });
  }

  async findByPolicy(policyId: string): Promise<BudgetIncident[]> {
    return this.prisma.budgetIncident.findMany({
      where: { budgetPolicyId: policyId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findActiveByTenant(tenantId: string): Promise<BudgetIncident[]> {
    return this.prisma.budgetIncident.findMany({
      where: {
        budgetPolicy: { tenantId },
        status: { in: ['ACTIVE', 'ACKNOWLEDGED'] },
      },
      include: {
        budgetPolicy: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async acknowledge(id: string): Promise<void> {
    await this.prisma.budgetIncident.update({
      where: { id },
      data: {
        status: 'ACKNOWLEDGED',
        acknowledgedAt: new Date(),
      },
    });
  }

  async resolve(id: string): Promise<void> {
    await this.prisma.budgetIncident.update({
      where: { id },
      data: {
        status: 'RESOLVED',
        resolvedAt: new Date(),
      },
    });
  }
}
