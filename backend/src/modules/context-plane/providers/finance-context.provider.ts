/**
 * FinanceContextProvider (Phase 3, ADR-002 §8).
 * Exposes only currently-implemented finance data: monthly expense-based cost
 * (BillingCalculatorService) and project budget context (from ProjectsService).
 * Budget/threshold tracking does NOT exist in the finance module (baseline
 * finding) — it is reported as UNAVAILABLE, never invented.
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import {
  CONTEXT_PLANE,
  type CapabilityContext,
  type ContextAuth,
  type ContextScope,
  type IOrganizationalContextPlane,
  type IOrganizationalContextProvider,
} from '../contracts/context-plane.interface';
import { decide, buildContext, unavailable } from './provider-authorization';
import { BillingCalculatorService } from '../../finance/services/billing-calculator.service';
import { ProjectsService } from '../../projects/projects.service';

@Injectable()
export class FinanceContextProvider
  implements IOrganizationalContextProvider, OnApplicationBootstrap
{
  readonly capability = 'finance';
  private readonly logger = new Logger(FinanceContextProvider.name);

  constructor(
    @Inject(CONTEXT_PLANE) private readonly plane: IOrganizationalContextPlane,
    private readonly billing: BillingCalculatorService,
    private readonly projects: ProjectsService,
  ) {}

  onApplicationBootstrap(): void {
    this.plane.registerProvider(this);
  }

  async getContext(
    auth: ContextAuth,
    scope: ContextScope,
  ): Promise<CapabilityContext> {
    // Finance is sensitive — higher thresholds.
    const authorization = decide(auth, this.capability, scope, {
      denyBelow: 40,
      redactBelow: 75,
    });
    if (authorization.access === 'DENIED') {
      return buildContext({
        capability: this.capability,
        provider: 'FinanceContextProvider',
        auth,
        scope,
        authorization,
        data: {},
      });
    }
    const redacted = authorization.access === 'REDACTED';

    try {
      const data: Record<string, unknown> = {};

      // Project budget context (budget lives on Project, not finance module).
      if (scope.projectId) {
        try {
          const p = await this.projects.findById(scope.projectId, auth.tenantId);
          data.projectBudget = redacted
            ? { available: true, detail: 'REDACTED' }
            : {
                type: p.budgetType,
                amount: p.budgetAmount,
                currency: p.budgetCurrency,
              };
        } catch {
          data.projectBudget = { available: false };
        }
      }

      // Tenant monthly cost (expense-based; the only implemented finance read).
      if (!redacted) {
        const now = new Date();
        const summary = await this.billing
          .calculateMonthly(auth.tenantId, now.getFullYear(), now.getMonth() + 1)
          .catch(() => null);
        data.monthlyCost = summary
          ? {
              grandTotal: summary.grandTotal,
              currency: summary.currency,
              periodStart: summary.periodStart,
              periodEnd: summary.periodEnd,
            }
          : { available: false };
      } else {
        data.monthlyCost = { available: true, detail: 'REDACTED' };
      }

      // Thresholds are NOT implemented in the finance module — report honestly.
      data.thresholds = {
        available: false,
        reason: 'threshold/budget-alert tracking not implemented in finance module',
      };

      return buildContext({
        capability: this.capability,
        provider: 'FinanceContextProvider',
        auth,
        scope,
        authorization,
        data,
        sourceEntities: scope.projectId
          ? [{ entityType: 'Project', entityId: scope.projectId }]
          : [],
      });
    } catch (err) {
      return unavailable({
        capability: this.capability,
        provider: 'FinanceContextProvider',
        auth,
        scope,
        reason: `error: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }
}
