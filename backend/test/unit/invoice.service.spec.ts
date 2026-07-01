import { Test, TestingModule } from '@nestjs/testing';
import { InvoiceService } from '../../src/modules/finance/services/invoice.service';
import { BillingEventsService } from '../../src/modules/finance/services/billing-events.service';
import { TaxService } from '../../src/modules/finance/services/tax.service';
import { PrismaService } from '../../src/infrastructure/database/prisma.service';

const mockPrisma = {
  invoice: {
    count: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
  $transaction: jest.fn((calls: any[]) => Promise.all(calls)),
};

const mockBillingEvents = { emit: jest.fn().mockResolvedValue(undefined) };
const taxService = new TaxService();

const baseLine = { description: 'API credits', qty: 10, unitPrice: 5.0 };

describe('InvoiceService', () => {
  let service: InvoiceService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InvoiceService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: BillingEventsService, useValue: mockBillingEvents },
        { provide: TaxService, useValue: taxService },
      ],
    }).compile();
    service = module.get(InvoiceService);
  });

  it('should generate an invoice with correct totals', async () => {
    const invoiceStub = { id: 'inv-1', number: 'INV-2026-0001', total: 50 };
    mockPrisma.invoice.count.mockResolvedValue(0);
    mockPrisma.invoice.create.mockResolvedValue(invoiceStub);

    const result = await service.create({
      tenantId: 'tenant-1',
      lineItems: [baseLine],
    });

    expect(result).toEqual(invoiceStub);
    expect(mockPrisma.invoice.create).toHaveBeenCalledTimes(1);
    expect(mockBillingEvents.emit).toHaveBeenCalledWith(
      'tenant-1',
      'INVOICE_CREATED',
      expect.objectContaining({ number: 'INV-2026-0001' }),
      'inv-1',
    );
  });

  it('should sequence invoice numbers within a tenant', async () => {
    const stub = { id: 'inv-2', number: 'INV-2026-0003', total: 50 };
    mockPrisma.invoice.count.mockResolvedValue(2); // 2 existing → next = 0003
    mockPrisma.invoice.create.mockResolvedValue(stub);

    const result = await service.create({
      tenantId: 'tenant-1',
      lineItems: [baseLine],
    });
    expect(result.number).toBe('INV-2026-0003');
  });

  it('should throw NotFoundException when findOne returns nothing', async () => {
    mockPrisma.invoice.findFirst.mockResolvedValue(null);
    await expect(service.findOne('bad-id', 'tenant-1')).rejects.toThrow(
      'Invoice bad-id not found',
    );
  });

  it('should update status to ISSUED on issue()', async () => {
    const existing = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      expenses: [],
      billingEvents: [],
    };
    const updated = { ...existing, status: 'ISSUED' };
    mockPrisma.invoice.findFirst.mockResolvedValue(existing);
    mockPrisma.invoice.update.mockResolvedValue(updated);

    const result = await service.issue('inv-1', 'tenant-1');
    expect(result.status).toBe('ISSUED');
    expect(mockBillingEvents.emit).toHaveBeenCalledWith(
      'tenant-1',
      'INVOICE_ISSUED',
      expect.any(Object),
      'inv-1',
    );
  });

  it('should update status to PAID on markPaid()', async () => {
    const existing = {
      id: 'inv-1',
      tenantId: 'tenant-1',
      expenses: [],
      billingEvents: [],
    };
    mockPrisma.invoice.findFirst.mockResolvedValue(existing);
    mockPrisma.invoice.update.mockResolvedValue({
      ...existing,
      status: 'PAID',
    });

    const result = await service.markPaid('inv-1', 'tenant-1');
    expect(result.status).toBe('PAID');
  });
});

describe('TaxService', () => {
  const tax = new TaxService();

  it.each([
    ['US', 0.08],
    ['GB', 0.2],
    ['EU', 0.2],
    ['AU', 0.1],
    ['ZZ', 0],
  ])('region %s → rate %f', (region, expected) => {
    expect(tax.getRate(region)).toBe(expected);
  });

  it('calculates tax amount correctly', () => {
    const result = tax.calculate(100, 'GB');
    expect(result.taxAmount).toBe(20);
    expect(result.taxable).toBe(100);
  });
});
