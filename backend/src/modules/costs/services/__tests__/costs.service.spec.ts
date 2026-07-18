/**
 * CostsService Unit Tests (Phase 8, ADR-007)
 *
 * Tests that checkBudgetThresholds:
 * - creates BudgetIncident on threshold breach
 * - emits enterprise.finance.threshold.exceeded (first breach only)
 * - skips event emission for already-breached thresholds (idempotent)
 * - handles PROJECT-scoped policies with projectId in payload
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EVENT_TRANSPORT } from '../../../enterprise-events/contracts/enterprise-event-transport.interface';
import type { IEnterpriseEventTransport } from '../../../enterprise-events/contracts/enterprise-event-transport.interface';
import { PrismaBudgetPolicyRepository } from '../../repositories/prisma-budget.repository';
import { PrismaBudgetIncidentRepository } from '../../repositories/prisma-budget.repository';
import { PrismaService } from '../../../../infrastructure/database/prisma.service';
import { LangSmithCostProvider } from '../../providers/langsmith-cost-provider';
import { PrismaCostRecordRepository } from '../../repositories/prisma-cost.repository';
import { CostsService } from '../costs.service';

describe('CostsService.checkBudgetThresholds', () => {
  let service: CostsService;
  let budgetRepo: jest.Mocked<PrismaBudgetPolicyRepository>;
  let incidentRepo: jest.Mocked<PrismaBudgetIncidentRepository>;
  let eventTransport: jest.Mocked<IEnterpriseEventTransport>;

  beforeEach(async () => {
    const mockBudgetRepo = {
      findActivePolicies: jest.fn(),
      updateSpend: jest.fn(),
    };
    const mockIncidentRepo = {
      findByPolicy: jest.fn(),
      create: jest.fn(),
    };
    const mockTransport = { publish: jest.fn() };
    const mockCostRepo = {};
    const mockCostProvider = {};
    const mockPrisma = {};

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CostsService,
        { provide: PrismaBudgetPolicyRepository, useValue: mockBudgetRepo },
        { provide: PrismaBudgetIncidentRepository, useValue: mockIncidentRepo },
        { provide: EVENT_TRANSPORT, useValue: mockTransport },
        { provide: PrismaCostRecordRepository, useValue: mockCostRepo },
        { provide: LangSmithCostProvider, useValue: mockCostProvider },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get(CostsService);
    budgetRepo = module.get(PrismaBudgetPolicyRepository);
    incidentRepo = module.get(PrismaBudgetIncidentRepository);
    eventTransport = module.get(EVENT_TRANSPORT);
  });

  const mockPolicy = (overrides: Record<string, unknown> = {}) => ({
    id: 'policy_1',
    name: 'Monthly Budget',
    tenantId: 'tenant_1',
    limitCents: 100000, // $1000.00
    currentSpendCents: 0,
    alertThresholds: [50, 75, 90],
    projectId: 'proj_1',
    ...overrides,
  });

  it('should emit enterprise.finance.threshold.exceeded on first breach at 50%', async () => {
    const policy = mockPolicy({ currentSpendCents: 49000 }); // 49% before new cost
    budgetRepo.findActivePolicies.mockResolvedValue([policy] as never);
    incidentRepo.findByPolicy.mockResolvedValue([]); // no existing incidents
    incidentRepo.create.mockResolvedValue({ id: 'incident_1' } as never);

    await service.checkBudgetThresholds('tenant_1', 2000); // +2% = 51%

    expect(incidentRepo.create).toHaveBeenCalledWith({
      budgetPolicyId: 'policy_1',
      threshold: 50,
      totalCents: 51000,
    });

    expect(eventTransport.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: 'enterprise.finance.threshold.exceeded',
        tenantId: 'tenant_1',
        payload: expect.objectContaining({
          policyId: 'policy_1',
          projectId: 'proj_1',
          threshold: 50,
          currentSpendCents: 51000,
          limitCents: 100000,
        }),
      }),
      expect.any(Object),
    );
  });

  it('should NOT emit event for already-breached threshold (idempotent)', async () => {
    const policy = mockPolicy({ currentSpendCents: 49000 });
    budgetRepo.findActivePolicies.mockResolvedValue([policy] as never);
    incidentRepo.findByPolicy.mockResolvedValue([
      { threshold: 50, status: 'ACTIVE' },
    ] as never);

    await service.checkBudgetThresholds('tenant_1', 2000);

    expect(eventTransport.publish).not.toHaveBeenCalled();
    expect(incidentRepo.create).not.toHaveBeenCalled();
  });

  it('should emit event for each newly breached threshold tier', async () => {
    const policy = mockPolicy({
      currentSpendCents: 49000, // 49% — next cost pushes to 56% (crosses 50% only)
      alertThresholds: [50, 75, 90],
    });
    budgetRepo.findActivePolicies.mockResolvedValue([policy] as never);
    incidentRepo.findByPolicy.mockResolvedValue([]); // no existing incidents
    incidentRepo.create.mockResolvedValue({} as never);

    await service.checkBudgetThresholds('tenant_1', 7000); // 49%+7% = 56%

    expect(eventTransport.publish).toHaveBeenCalledTimes(1);
    expect(eventTransport.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          threshold: 50,
          currentSpendCents: 56000,
        }),
      }),
      expect.any(Object),
    );
  });

  it('should handle PROJECT-scoped policy with projectId in event payload', async () => {
    const policy = mockPolicy({ projectId: 'proj_special', currentSpendCents: 49000 });
    budgetRepo.findActivePolicies.mockResolvedValue([policy] as never);
    incidentRepo.findByPolicy.mockResolvedValue([] as never);
    incidentRepo.create.mockResolvedValue({} as never);

    await service.checkBudgetThresholds('tenant_1', 2000); // 49%+2% = 51%

    expect(eventTransport.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          projectId: 'proj_special',
          policyId: 'policy_1',
          threshold: 50,
        }),
      }),
      expect.any(Object),
    );
  });

  it('should handle null projectId for tenant-scoped policy', async () => {
    const policy = mockPolicy({ projectId: null, currentSpendCents: 49000 });
    budgetRepo.findActivePolicies.mockResolvedValue([policy] as never);
    incidentRepo.findByPolicy.mockResolvedValue([] as never);
    incidentRepo.create.mockResolvedValue({} as never);

    await service.checkBudgetThresholds('tenant_1', 2000); // 49%+2% = 51%

    expect(eventTransport.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({
          projectId: null,
        }),
      }),
      expect.any(Object),
    );
  });

  it('should update currentSpend after threshold check', async () => {
    const policy = mockPolicy({ currentSpendCents: 49000 });
    budgetRepo.findActivePolicies.mockResolvedValue([policy] as never);
    incidentRepo.findByPolicy.mockResolvedValue([
      { threshold: 50, status: 'ACTIVE' },
    ] as never);

    await service.checkBudgetThresholds('tenant_1', 2000);

    expect(budgetRepo.updateSpend).toHaveBeenCalledWith('policy_1', 51000);
  });

  it('should continue checking other policies if one fails', async () => {
    const policy1 = mockPolicy({ id: 'p1', currentSpendCents: 49000 });
    const policy2 = mockPolicy({ id: 'p2', currentSpendCents: 49000 });
    budgetRepo.findActivePolicies.mockResolvedValue([policy1, policy2] as never);
    incidentRepo.findByPolicy.mockResolvedValue([] as never);
    incidentRepo.create
      .mockRejectedValueOnce(new Error('DB error')) // p1 fails
      .mockResolvedValueOnce({} as never) // p2 succeeds
      .mockResolvedValue({} as never); // default for any further calls

    // Should not throw
    await expect(service.checkBudgetThresholds('tenant_1', 2000)).resolves.not.toThrow();

    // p2 should still get its event (and p1's updateSpend should still be called since we continue)
    expect(budgetRepo.updateSpend).toHaveBeenCalledTimes(2);
  });
});
