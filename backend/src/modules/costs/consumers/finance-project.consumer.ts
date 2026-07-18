/**
 * FinanceProjectConsumer (Phase 8, ADR-007)
 *
 * Subscribes to project lifecycle events and creates/syncs project-scoped
 * budget policies in the Costs module.
 *
 * Reactions:
 * - enterprise.project.created (with budgetAmount > 0) → create PROJECT-scoped BudgetPolicy
 * - enterprise.project.budget.changed → sync limitCents on the existing BudgetPolicy
 *
 * This consumer lives in the Costs module (budget policy owner). It does NOT
 * own budget tracking logic — it only bridges Projects → Finance via the event
 * fabric. All other budget logic (threshold checking, incident creation) lives
 * in CostsService, unchanged.
 *
 * SRP: only handles project→finance bridge events
 * OCP: add new project event reactions without modifying existing handlers
 * DIP: depends on IEnterpriseEventTransport port, not concrete fabric
 */

import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  Inject,
} from '@nestjs/common';
import { EVENT_TRANSPORT } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { EnterpriseEvent } from '../../enterprise-events/contracts/enterprise-event.interface';
import { IdempotencyService } from '../../enterprise-events/idempotency/idempotency.service';
import { PrismaBudgetPolicyRepository } from '../repositories/prisma-budget.repository';

export const FINANCE_PROJECT_CONSUMER_ID = 'finance-project-bridge';

interface ProjectCreatedPayload {
  projectId: string;
  name: string;
  budgetAmount: number | null;
  budgetCurrency?: string;
  status?: string;
}

interface ProjectBudgetChangedPayload {
  projectId: string;
  previousAmount: number | null;
  newAmount: number | null;
  currency: string;
}

@Injectable()
export class FinanceProjectConsumer implements OnApplicationBootstrap {
  private readonly logger = new Logger(FinanceProjectConsumer.name);

  constructor(
    @Inject(EVENT_TRANSPORT)
    private readonly transport: IEnterpriseEventTransport,
    private readonly idempotency: IdempotencyService,
    private readonly budgetRepo: PrismaBudgetPolicyRepository,
  ) {}

  onApplicationBootstrap(): void {
    this.transport.registerConsumer({
      consumerId: FINANCE_PROJECT_CONSUMER_ID,
      eventTypes: [
        'enterprise.project.created',
        'enterprise.project.budget.changed',
      ],
      handler: (event) => this.handle(event),
    });
    this.logger.log('FinanceProjectConsumer registered for project events');
  }

  private async handle(event: EnterpriseEvent): Promise<void> {
    await this.idempotency.runOnce(
      event.idempotencyKey,
      FINANCE_PROJECT_CONSUMER_ID,
      event.tenantId,
      async () => {
        switch (event.eventType) {
          case 'enterprise.project.created':
            await this.onProjectCreated(event);
            break;
          case 'enterprise.project.budget.changed':
            await this.onProjectBudgetChanged(event);
            break;
        }
      },
    );
  }

  private async onProjectCreated(event: EnterpriseEvent): Promise<void> {
    const payload = event.payload as unknown as ProjectCreatedPayload;
    const { projectId, name, budgetAmount, budgetCurrency } = payload;

    if (!projectId) {
      this.logger.warn(`onProjectCreated: missing projectId in event ${event.eventId}`);
      return;
    }

    if (budgetAmount == null || budgetAmount <= 0) {
      this.logger.debug(
        `onProjectCreated: project ${projectId} has no budget, skipping policy creation`,
      );
      return;
    }

    const existing = await this.budgetRepo.findByProject(projectId);
    if (existing) {
      this.logger.debug(
        `onProjectCreated: project ${projectId} already has budget policy ${(existing as { id: string }).id}, skipping`,
      );
      return;
    }

    const limitCents = Math.round(budgetAmount * 100);
    await this.budgetRepo.create({
      tenantId: event.tenantId,
      name: `Budget: ${name || projectId}`,
      limitCents,
      period: 'MONTHLY',
      scope: 'PROJECT',
      projectId,
      alertThresholds: [50, 75, 90],
      action: 'ALERT',
      enabled: true,
    });

    this.logger.log(
      `Created PROJECT-scoped BudgetPolicy for project ${projectId} ` +
        `(limit=${limitCents} cents, currency=${budgetCurrency ?? 'USD'})`,
    );
  }

  private async onProjectBudgetChanged(event: EnterpriseEvent): Promise<void> {
    const payload = event.payload as unknown as ProjectBudgetChangedPayload;
    const { projectId, newAmount } = payload;

    if (!projectId) {
      this.logger.warn(`onProjectBudgetChanged: missing projectId in event ${event.eventId}`);
      return;
    }

    const policy = await this.budgetRepo.findByProject(projectId);
    if (!policy) {
      this.logger.debug(
        `onProjectBudgetChanged: project ${projectId} has no BudgetPolicy, nothing to sync`,
      );
      return;
    }

    const policyAny = policy as Record<string, unknown>;
    const newLimitCents =
      newAmount != null ? Math.round(newAmount * 100) : policyAny.limitCents as number;

    await this.budgetRepo.update(policyAny.id as string, {
      limitCents: newLimitCents,
    });

    this.logger.log(
      `Synced BudgetPolicy ${policyAny.id as string} for project ${projectId} ` +
        `(new limit=${newLimitCents} cents)`,
    );
  }
}
