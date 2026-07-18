/**
 * FinanceProjectConsumer Unit Tests (Phase 8, ADR-007)
 *
 * Tests the project→finance bridge consumer:
 * - enterprise.project.created → creates PROJECT-scoped BudgetPolicy
 * - enterprise.project.budget.changed → syncs existing BudgetPolicy limit
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EVENT_TRANSPORT } from '../../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { EnterpriseEvent } from '../../../enterprise-events/contracts/enterprise-event.interface';
import { IdempotencyService } from '../../../enterprise-events/idempotency/idempotency.service';
import { FinanceProjectConsumer } from '../finance-project.consumer';
import { PrismaBudgetPolicyRepository } from '../../repositories/prisma-budget.repository';

describe('FinanceProjectConsumer', () => {
  let consumer: FinanceProjectConsumer;
  let budgetRepo: jest.Mocked<PrismaBudgetPolicyRepository>;
  let eventTransport: jest.Mocked<IEnterpriseEventTransport>;
  let idempotency: jest.Mocked<IdempotencyService>;

  beforeEach(async () => {
    const mockBudgetRepo = {
      findByProject: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    };
    const mockTransport = {
      registerConsumer: jest.fn(),
      publish: jest.fn(),
    };
    const mockIdempotency = {
      runOnce: jest.fn((_key, _consumerId, _tenantId, fn) => fn()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FinanceProjectConsumer,
        { provide: PrismaBudgetPolicyRepository, useValue: mockBudgetRepo },
        { provide: EVENT_TRANSPORT, useValue: mockTransport },
        { provide: IdempotencyService, useValue: mockIdempotency },
      ],
    }).compile();

    consumer = module.get(FinanceProjectConsumer);
    budgetRepo = module.get(PrismaBudgetPolicyRepository);
    eventTransport = module.get(EVENT_TRANSPORT);
    idempotency = module.get(IdempotencyService);

    consumer.onApplicationBootstrap();
  });

  describe('registration', () => {
    it('should register for enterprise.project.created and enterprise.project.budget.changed', () => {
      expect(eventTransport.registerConsumer).toHaveBeenCalledWith(
        expect.objectContaining({
          consumerId: 'finance-project-bridge',
          eventTypes: [
            'enterprise.project.created',
            'enterprise.project.budget.changed',
          ],
        }),
      );
    });
  });

  describe('onProjectCreated', () => {
    const makeEvent = (payload: Record<string, unknown>): EnterpriseEvent =>
      ({
        eventId: 'evt_1',
        eventType: 'enterprise.project.created',
        version: 1,
        tenantId: 'tenant_1',
        actorId: null,
        actorType: 'SYSTEM',
        correlationId: 'corr_1',
        causationId: null,
        idempotencyKey: 'idem_1',
        sourceModule: 'projects',
        payload,
      } as unknown as EnterpriseEvent);

    it('should create a PROJECT-scoped BudgetPolicy when project has a budget', async () => {
      budgetRepo.findByProject.mockResolvedValue(null);
      budgetRepo.create.mockResolvedValue({ id: 'policy_1' } as never);

      const event = makeEvent({
        projectId: 'proj_1',
        name: 'Website Redesign',
        budgetAmount: 5000,
        budgetCurrency: 'USD',
      });

      await (eventTransport.registerConsumer as jest.Mock).mock.calls[0][0].handler(event);

      expect(budgetRepo.findByProject).toHaveBeenCalledWith('proj_1');
      expect(budgetRepo.create).toHaveBeenCalledWith({
        tenantId: 'tenant_1',
        name: 'Budget: Website Redesign',
        limitCents: 500000,
        period: 'MONTHLY',
        scope: 'PROJECT',
        projectId: 'proj_1',
        alertThresholds: [50, 75, 90],
        action: 'ALERT',
        enabled: true,
      });
    });

    it('should skip if project has no budgetAmount', async () => {
      const event = makeEvent({
        projectId: 'proj_1',
        name: 'Free Project',
        budgetAmount: null,
      });

      await (eventTransport.registerConsumer as jest.Mock).mock.calls[0][0].handler(event);

      expect(budgetRepo.findByProject).not.toHaveBeenCalled();
      expect(budgetRepo.create).not.toHaveBeenCalled();
    });

    it('should skip if budgetAmount is 0', async () => {
      const event = makeEvent({
        projectId: 'proj_1',
        name: 'Zero Budget',
        budgetAmount: 0,
      });

      await (eventTransport.registerConsumer as jest.Mock).mock.calls[0][0].handler(event);

      expect(budgetRepo.create).not.toHaveBeenCalled();
    });

    it('should skip if project already has a BudgetPolicy', async () => {
      budgetRepo.findByProject.mockResolvedValue({ id: 'existing_policy' } as never);

      const event = makeEvent({
        projectId: 'proj_1',
        name: 'Website Redesign',
        budgetAmount: 5000,
      });

      await (eventTransport.registerConsumer as jest.Mock).mock.calls[0][0].handler(event);

      expect(budgetRepo.create).not.toHaveBeenCalled();
    });

    it('should handle missing projectId gracefully', async () => {
      const event = makeEvent({ name: 'No ID Project' });

      await (eventTransport.registerConsumer as jest.Mock).mock.calls[0][0].handler(event);

      expect(budgetRepo.create).not.toHaveBeenCalled();
    });
  });

  describe('onProjectBudgetChanged', () => {
    const makeEvent = (payload: Record<string, unknown>): EnterpriseEvent =>
      ({
        eventId: 'evt_2',
        eventType: 'enterprise.project.budget.changed',
        version: 1,
        tenantId: 'tenant_1',
        actorId: null,
        actorType: 'SYSTEM',
        correlationId: 'corr_2',
        causationId: null,
        idempotencyKey: 'idem_2',
        sourceModule: 'projects',
        payload,
      } as unknown as EnterpriseEvent);

    it('should update existing BudgetPolicy limitCents', async () => {
      budgetRepo.findByProject.mockResolvedValue({
        id: 'policy_1',
        limitCents: 300000,
      } as never);
      budgetRepo.update.mockResolvedValue({} as never);

      const event = makeEvent({
        projectId: 'proj_1',
        previousAmount: 3000,
        newAmount: 8000,
        currency: 'USD',
      });

      await (eventTransport.registerConsumer as jest.Mock).mock.calls[0][0].handler(event);

      expect(budgetRepo.update).toHaveBeenCalledWith('policy_1', {
        limitCents: 800000,
      });
    });

    it('should do nothing if no BudgetPolicy exists for project', async () => {
      budgetRepo.findByProject.mockResolvedValue(null);

      const event = makeEvent({
        projectId: 'proj_orphan',
        previousAmount: 1000,
        newAmount: 5000,
        currency: 'USD',
      });

      await (eventTransport.registerConsumer as jest.Mock).mock.calls[0][0].handler(event);

      expect(budgetRepo.update).not.toHaveBeenCalled();
    });

    it('should handle missing projectId gracefully', async () => {
      const event = makeEvent({ newAmount: 5000 });

      await (eventTransport.registerConsumer as jest.Mock).mock.calls[0][0].handler(event);

      expect(budgetRepo.findByProject).not.toHaveBeenCalled();
    });
  });
});
