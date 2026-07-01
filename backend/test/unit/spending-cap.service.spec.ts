import { Test, TestingModule } from '@nestjs/testing';
import { SpendingCapService } from '../../src/modules/reliability/services/spending-cap.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { BillingCalculatorService } from '../../src/modules/finance/services/billing-calculator.service';

type MockPrisma = { tenantLimit: { findUnique: jest.Mock; upsert: jest.Mock } };
type MockCalculator = { calculateMonthly: jest.Mock };

const mockPrisma: MockPrisma = {
  tenantLimit: {
    findUnique: jest.fn(),
    upsert: jest.fn(),
  },
};

const mockCalculator: MockCalculator = {
  calculateMonthly: jest.fn(),
};

describe('SpendingCapService', () => {
  let service: SpendingCapService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SpendingCapService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BillingCalculatorService, useValue: mockCalculator },
      ],
    }).compile();
    service = module.get(SpendingCapService);
  });

  it('returns blocked=false when no caps are configured', async () => {
    mockPrisma.tenantLimit.findUnique.mockResolvedValue(null);
    mockCalculator.calculateMonthly.mockResolvedValue({ grandTotal: 999 });

    const result = await service.evaluate('tenant-1');
    expect(result.blocked).toBe(false);
    expect(result.atSoftCap).toBe(false);
  });

  it('marks atSoftCap when spend ≥ softCapUsd', async () => {
    mockPrisma.tenantLimit.findUnique.mockResolvedValue({
      limits: { spending_soft_cap_usd: 100, spending_hard_cap_usd: 500 },
    });
    mockCalculator.calculateMonthly.mockResolvedValue({ grandTotal: 150 });

    const result = await service.evaluate('tenant-1');
    expect(result.atSoftCap).toBe(true);
    expect(result.atHardCap).toBe(false);
    expect(result.blocked).toBe(false);
  });

  it('marks blocked=true when spend ≥ hardCapUsd', async () => {
    mockPrisma.tenantLimit.findUnique.mockResolvedValue({
      limits: { spending_soft_cap_usd: 100, spending_hard_cap_usd: 200 },
    });
    mockCalculator.calculateMonthly.mockResolvedValue({ grandTotal: 250 });

    const result = await service.evaluate('tenant-1');
    expect(result.atHardCap).toBe(true);
    expect(result.blocked).toBe(true);
  });

  it('setSoftCap upserts the correct key', async () => {
    mockPrisma.tenantLimit.findUnique.mockResolvedValue(null);
    mockPrisma.tenantLimit.upsert.mockResolvedValue({});

    await service.setSoftCap('tenant-1', 500);
    expect(mockPrisma.tenantLimit.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          limits: { spending_soft_cap_usd: 500 },
        }),
      }),
    );
  });
});
