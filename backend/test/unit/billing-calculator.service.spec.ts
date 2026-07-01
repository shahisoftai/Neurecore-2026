import { Test, TestingModule } from '@nestjs/testing';
import { BillingCalculatorService } from '../../src/modules/finance/services/billing-calculator.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';
import { ExpenseCategory } from '@prisma/client';

const mockPrisma = {
  expense: {
    findMany: jest.fn(),
    create: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn((arr: Promise<unknown>[]) => Promise.all(arr)),
};

describe('BillingCalculatorService', () => {
  let service: BillingCalculatorService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingCalculatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get(BillingCalculatorService);
  });

  it('calculates grand total from mixed expense categories', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { category: ExpenseCategory.AGENT_EXECUTION, amountUsd: '10.00' },
      { category: ExpenseCategory.API_CALL, amountUsd: '5.00' },
      { category: ExpenseCategory.MODEL_INFERENCE, amountUsd: '2.50' },
    ]);

    const result = await service.calculatePeriod(
      'tenant-1',
      new Date('2026-02-01'),
      new Date('2026-02-28'),
    );

    expect(result.grandTotal).toBeCloseTo(17.5);
    expect(result.totalAgentExecutionCost).toBeCloseTo(10);
    expect(result.totalApiCost).toBeCloseTo(7.5);
  });

  it('returns zero totals when no expenses exist', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([]);

    const result = await service.calculatePeriod(
      'tenant-1',
      new Date('2026-02-01'),
      new Date('2026-02-28'),
    );

    expect(result.grandTotal).toBe(0);
    expect(result.totalAgentExecutionCost).toBe(0);
  });

  it('calculateMonthly calls calculatePeriod with correct date range', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([]);
    const spy = jest.spyOn(service, 'calculatePeriod');

    await service.calculateMonthly('tenant-1', 2026, 2);

    expect(spy).toHaveBeenCalledWith(
      'tenant-1',
      new Date(2026, 1, 1),
      new Date(2026, 2, 0, 23, 59, 59, 999),
    );
  });

  it('recordExpense creates an expense record', async () => {
    const stub = { id: 'exp-1', category: 'API_CALL', amountUsd: '0.05' };
    mockPrisma.expense.create.mockResolvedValue(stub);

    const result = await service.recordExpense(
      'tenant-1',
      'API_CALL',
      'OpenAI call',
      0.05,
    );
    expect(result).toEqual(stub);
    expect(mockPrisma.expense.create).toHaveBeenCalledTimes(1);
  });
});
