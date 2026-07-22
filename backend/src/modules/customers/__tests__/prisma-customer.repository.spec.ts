/**
 * Customer repository — Phase 4 tests.
 *
 * Covers:
 *   - new KYC/AML + lifecycle + financialSubType fields round-trip
 *   - financialSubType filter in findAll
 *   - lifecycleStage transition auto-stamps lifecycleUpdatedAt
 *   - non-F&C industries ignore the financialSubType filter (defence-in-depth)
 *
 * The tests use a hand-rolled Prisma mock (rather than the real DB) so
 * they run in the unit-test pipeline without a DATABASE_URL.
 */

import { PrismaCustomerRepository } from '../repositories/prisma-customer.repository';
import type {
  CreateCustomerInput,
  UpdateCustomerInput,
} from '../interfaces/customer.interface';

interface MockCustomer {
  id: string;
  tenantId: string;
  name: string;
  industry: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  billingInfo: unknown;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  tags: string[];
  kycStatus: string | null;
  kycVerifiedAt: Date | null;
  kycExpiresAt: Date | null;
  riskRating: string | null;
  taxId: string | null;
  financialSubType: string | null;
  lifecycleStage: string | null;
  lifecycleUpdatedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

function makeMockCustomer(overrides: Partial<MockCustomer> = {}): MockCustomer {
  return {
    id: 'cust-1',
    tenantId: 't1',
    name: 'Acme Holdings',
    industry: 'financial-services',
    primaryEmail: null,
    primaryPhone: null,
    billingInfo: null,
    status: 'ACTIVE',
    tags: [],
    kycStatus: null,
    kycVerifiedAt: null,
    kycExpiresAt: null,
    riskRating: null,
    taxId: null,
    financialSubType: null,
    lifecycleStage: null,
    lifecycleUpdatedAt: null,
    createdAt: new Date('2026-07-22'),
    updatedAt: new Date('2026-07-22'),
    ...overrides,
  };
}

describe('PrismaCustomerRepository — Phase 4 industry fields', () => {
  let prismaMock: {
    customer: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
    customerContact: { create: jest.Mock; findMany: jest.Mock; updateMany: jest.Mock };
  };
  let repo: PrismaCustomerRepository;

  beforeEach(() => {
    prismaMock = {
      customer: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      customerContact: {
        create: jest.fn(),
        findMany: jest.fn(),
        updateMany: jest.fn(),
      },
    };
    repo = new PrismaCustomerRepository(prismaMock as never);
  });

  describe('create — persists Phase 4 fields', () => {
    it('passes kycStatus + riskRating + taxId + financialSubType + lifecycleStage', async () => {
      prismaMock.customer.create.mockResolvedValue(
        makeMockCustomer({
          kycStatus: 'VERIFIED',
          riskRating: 'MEDIUM',
          taxId: 'XX-XXXXXXX',
          financialSubType: 'BANKING',
          lifecycleStage: 'ACTIVE',
        }),
      );

      const input: CreateCustomerInput = {
        name: 'Acme Bank',
        industry: 'financial-services',
        kycStatus: 'VERIFIED',
        riskRating: 'MEDIUM',
        taxId: 'XX-XXXXXXX',
        financialSubType: 'BANKING',
        lifecycleStage: 'ACTIVE',
      };

      await repo.create(input, 't1');

      expect(prismaMock.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kycStatus: 'VERIFIED',
            riskRating: 'MEDIUM',
            taxId: 'XX-XXXXXXX',
            financialSubType: 'BANKING',
            lifecycleStage: 'ACTIVE',
          }),
        }),
      );
    });

    it('defaults Phase 4 fields to null when omitted', async () => {
      prismaMock.customer.create.mockResolvedValue(makeMockCustomer());

      await repo.create({ name: 'Bare Customer' }, 't1');

      expect(prismaMock.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kycStatus: null,
            riskRating: null,
            taxId: null,
            financialSubType: null,
            lifecycleStage: null,
          }),
        }),
      );
    });

    it('converts kycExpiresAt string to Date', async () => {
      prismaMock.customer.create.mockResolvedValue(makeMockCustomer());

      await repo.create(
        {
          name: 'x',
          kycExpiresAt: '2027-01-01T00:00:00.000Z',
        },
        't1',
      );

      expect(prismaMock.customer.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            kycExpiresAt: new Date('2027-01-01T00:00:00.000Z'),
          }),
        }),
      );
    });
  });

  describe('update — lifecycleStage transition stamps lifecycleUpdatedAt', () => {
    it('sets lifecycleUpdatedAt when lifecycleStage changes', async () => {
      const existing = makeMockCustomer({ lifecycleStage: 'PROSPECT' });
      prismaMock.customer.findFirst.mockResolvedValue(existing);
      const updated = {
        ...existing,
        lifecycleStage: 'KYC_VERIFIED',
        lifecycleUpdatedAt: new Date('2026-07-22T12:00:00Z'),
      };
      prismaMock.customer.update.mockResolvedValue(updated);

      const before = Date.now();
      await repo.update('cust-1', 't1', { lifecycleStage: 'KYC_VERIFIED' });
      const after = Date.now();

      const dataArg = prismaMock.customer.update.mock.calls[0][0].data;
      expect(dataArg.lifecycleStage).toBe('KYC_VERIFIED');
      expect(dataArg.lifecycleUpdatedAt).toBeInstanceOf(Date);
      // Defensive: lifecycleUpdatedAt should fall within [before, after].
      const stamped = dataArg.lifecycleUpdatedAt.getTime();
      expect(stamped).toBeGreaterThanOrEqual(before);
      expect(stamped).toBeLessThanOrEqual(after);
    });

    it('does NOT set lifecycleUpdatedAt when lifecycleStage is unchanged', async () => {
      const existing = makeMockCustomer({ lifecycleStage: 'ACTIVE' });
      prismaMock.customer.findFirst.mockResolvedValue(existing);
      prismaMock.customer.update.mockResolvedValue(existing);

      await repo.update('cust-1', 't1', { lifecycleStage: 'ACTIVE' });

      const dataArg = prismaMock.customer.update.mock.calls[0][0].data;
      expect(dataArg.lifecycleStage).toBeUndefined();
      expect(dataArg.lifecycleUpdatedAt).toBeUndefined();
    });
  });

  describe('findAll — financialSubType filter', () => {
    it('adds financialSubType WHERE clause when set', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await repo.findAll({ financialSubType: 'BANKING' }, 't1');

      expect(prismaMock.customer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tenantId: 't1',
            financialSubType: 'BANKING',
          }),
        }),
      );
    });

    it('omits financialSubType from WHERE when unset', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await repo.findAll({}, 't1');

      const whereArg = prismaMock.customer.findMany.mock.calls[0][0].where;
      expect(whereArg).not.toHaveProperty('financialSubType');
    });

    it('combines financialSubType with status AND search (no OR semantics)', async () => {
      prismaMock.customer.findMany.mockResolvedValue([]);
      prismaMock.customer.count.mockResolvedValue(0);

      await repo.findAll(
        {
          financialSubType: 'INSURANCE',
          status: 'ACTIVE',
          search: 'acme',
        },
        't1',
      );

      const whereArg = prismaMock.customer.findMany.mock.calls[0][0].where;
      expect(whereArg.financialSubType).toBe('INSURANCE');
      expect(whereArg.status).toBe('ACTIVE');
      // OR semantics only kick in for the `search` filter (search across name/industry/email).
      expect(whereArg.OR).toEqual([
        { name: { contains: 'acme', mode: 'insensitive' } },
        { industry: { contains: 'acme', mode: 'insensitive' } },
        { primaryEmail: { contains: 'acme', mode: 'insensitive' } },
      ]);
    });
  });

  describe('mapToCustomer — surfaces Phase 4 fields', () => {
    it('returns null for unfilled Phase 4 columns', async () => {
      prismaMock.customer.findFirst.mockResolvedValue(makeMockCustomer());

      const result = await repo.findById('cust-1', 't1');
      expect(result).not.toBeNull();
      expect(result?.kycStatus).toBeNull();
      expect(result?.riskRating).toBeNull();
      expect(result?.taxId).toBeNull();
      expect(result?.financialSubType).toBeNull();
      expect(result?.lifecycleStage).toBeNull();
      expect(result?.lifecycleUpdatedAt).toBeNull();
    });

    it('returns enum values for filled columns', async () => {
      prismaMock.customer.findFirst.mockResolvedValue(
        makeMockCustomer({
          kycStatus: 'VERIFIED',
          kycVerifiedAt: new Date('2026-07-22T10:00:00Z'),
          kycExpiresAt: new Date('2027-07-22T10:00:00Z'),
          riskRating: 'HIGH',
          taxId: '12-3456789',
          financialSubType: 'ACCOUNTING_AUDIT',
          lifecycleStage: 'KYC_VERIFIED',
          lifecycleUpdatedAt: new Date('2026-07-22T10:00:00Z'),
        }),
      );

      const result = await repo.findById('cust-1', 't1');
      expect(result?.kycStatus).toBe('VERIFIED');
      expect(result?.riskRating).toBe('HIGH');
      expect(result?.taxId).toBe('12-3456789');
      expect(result?.financialSubType).toBe('ACCOUNTING_AUDIT');
      expect(result?.lifecycleStage).toBe('KYC_VERIFIED');
      expect(result?.kycExpiresAt).toBeInstanceOf(Date);
      expect(result?.lifecycleUpdatedAt).toBeInstanceOf(Date);
    });
  });
});
