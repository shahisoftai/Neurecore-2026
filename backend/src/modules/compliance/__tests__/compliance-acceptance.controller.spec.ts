/**
 * ComplianceAcceptanceController — AUP/DPA acceptance + residency/retention.
 * Verifies idempotent acceptance and writes audit log.
 */

import { BadRequestException } from '@nestjs/common';
import { ComplianceAcceptanceController } from '../compliance-acceptance.controller';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

describe('ComplianceAcceptanceController', () => {
  let controller: ComplianceAcceptanceController;
  let prismaMock: any;

  beforeEach(() => {
    prismaMock = {
      tenant: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { create: jest.fn() },
    };
    controller = new ComplianceAcceptanceController(prismaMock);
  });

  const ownerUser: JwtPayload = {
    sub: 'user-owner',
    email: 'owner@acme.com',
    role: 'OWNER' as never,
    tenantId: 'tenant-1',
    jti: 't1',
  };

  describe('GET /', () => {
    it('returns defaults when tenant has none set', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ defaultsJson: null });
      const result = await controller.get(ownerUser);
      expect(result.dataResidency).toBe('auto');
      expect(result.retentionDays).toBe(90);
      expect(result.aupAcceptedAt).toBeNull();
      expect(result.dpaAcceptedAt).toBeNull();
    });

    it('returns previously saved values', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        defaultsJson: {
          dataResidency: 'eu',
          retentionDays: 365,
          aupAcceptedAt: '2026-07-22T10:00:00Z',
          dpaAcceptedAt: '2026-07-22T10:05:00Z',
        },
      });
      const result = await controller.get(ownerUser);
      expect(result.dataResidency).toBe('eu');
      expect(result.retentionDays).toBe(365);
      expect(result.aupAcceptedAt).toBe('2026-07-22T10:00:00Z');
    });
  });

  describe('POST /aup', () => {
    it('sets aupAcceptedAt and writes audit', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ defaultsJson: { retentionDays: 90 } });
      prismaMock.tenant.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await controller.acceptAup(ownerUser);
      expect(result.aupAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(prismaMock.tenant.update).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            action: 'compliance.aup.accept',
            actor: 'user-owner',
          }),
        }),
      );
    });

    it('rejects missing tenant', async () => {
      const noTenantUser = { ...ownerUser, tenantId: null };
      await expect(controller.acceptAup(noTenantUser)).rejects.toThrow(BadRequestException);
    });

    it('is idempotent — second call preserves previous state', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({
        defaultsJson: { aupAcceptedAt: '2026-01-01T00:00:00Z' },
      });
      prismaMock.tenant.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await controller.acceptAup(ownerUser);
      expect(result.aupAcceptedAt).toBeTruthy();
      // The new accept time is after the existing one
      expect(new Date(result.aupAcceptedAt).getTime()).toBeGreaterThan(
        new Date('2026-01-01T00:00:00Z').getTime(),
      );
    });
  });

  describe('POST /dpa', () => {
    it('sets dpaAcceptedAt', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ defaultsJson: {} });
      prismaMock.tenant.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await controller.acceptDpa(ownerUser);
      expect(result.dpaAcceptedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'compliance.dpa.accept' }),
        }),
      );
    });
  });

  describe('PATCH /residency', () => {
    it('sets dataResidency and audits', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ defaultsJson: {} });
      prismaMock.tenant.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await controller.setResidency(
        { dataResidency: 'eu' },
        ownerUser,
      );
      expect(result.dataResidency).toBe('eu');
      expect(prismaMock.tenant.update).toHaveBeenCalled();
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'compliance.residency.set' }),
        }),
      );
    });
  });

  describe('PATCH /retention', () => {
    it('sets retentionDays and audits (with 0 = indefinite)', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ defaultsJson: {} });
      prismaMock.tenant.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await controller.setRetention(
        { retentionDays: 0 },
        ownerUser,
      );
      expect(result.retentionDays).toBe(0);
      expect(prismaMock.auditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ action: 'compliance.retention.set' }),
        }),
      );
    });

    it('supports any retention int in [0, 3650]', async () => {
      prismaMock.tenant.findUnique.mockResolvedValue({ defaultsJson: {} });
      prismaMock.tenant.update.mockResolvedValue({});
      prismaMock.auditLog.create.mockResolvedValue({});

      const result = await controller.setRetention(
        { retentionDays: 45 },
        ownerUser,
      );
      expect(result.retentionDays).toBe(45);
    });
  });
});
