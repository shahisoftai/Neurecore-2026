/**
 * two-factor.service.spec.ts — Unit tests with a mocked PrismaService.
 *
 * Verifies the enable/init/disable state machine without TOTP secrets leaking
 * (re-tests use the live TOTP from totp.util.spec for end-to-end correctness).
 */

import { BadRequestException } from '@nestjs/common';
import { TwoFactorService } from '../two-factor.service';

describe('TwoFactorService', () => {
  let prismaMock: any;
  let passwordServiceMock: any;
  let service: TwoFactorService;

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    passwordServiceMock = {
      compare: jest.fn(),
    };
    service = new TwoFactorService(prismaMock, passwordServiceMock);
  });

  describe('getStatus()', () => {
    it('returns enabled=false when metadata has no flag', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ metadata: {} });
      const result = await service.getStatus('user-1');
      expect(result.enabled).toBe(false);
      expect(result.hasSecret).toBe(false);
      expect(result.lastChallengeAt).toBeNull();
    });

    it('returns enabled=true when flag is set', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        metadata: {
          twoFactorEnabled: true,
          twoFactorSecret: 'JBSWY3DPEHPK3PXP',
          last2FAChallengeAt: '2026-07-22T12:00:00Z',
        },
      });
      const result = await service.getStatus('user-1');
      expect(result.enabled).toBe(true);
      expect(result.hasSecret).toBe(true);
      expect(result.lastChallengeAt).toBe('2026-07-22T12:00:00Z');
    });

    it('throws for unknown user', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);
      await expect(service.getStatus('user-X')).rejects.toThrow(BadRequestException);
    });
  });

  describe('init()', () => {
    it('generates a fresh secret and stores under pending', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        email: 'alice@acme.com',
        metadata: {},
      });
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.init('user-1');
      expect(result.secret).toMatch(/^[A-Z2-7]{32}$/);
      expect(result.otpauthUri).toContain('otpauth://totp/');
      expect(result.otpauthUri).toContain(result.secret);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              twoFactorPendingSecret: result.secret,
            }),
          }),
        }),
      );
    });

    it('throws when 2FA is already enabled', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        metadata: { twoFactorEnabled: true },
      });
      await expect(service.init('user-1')).rejects.toThrow(/already enabled/);
    });
  });

  describe('enable() with valid code', () => {
    it('promotes pending → active when code is valid', async () => {
      // First get the actual pending secret so the code aligns:
      prismaMock.user.findUnique
        .mockResolvedValueOnce({ metadata: {} }); // init finds user
      const initResult = await service.init('user-1');
      // Reset mocks between phases
      prismaMock.user.findUnique.mockReset();
      const { totpAt } = require('../totp.util');
      const code = totpAt(initResult.secret, new Date());
      prismaMock.user.findUnique.mockResolvedValueOnce({
        metadata: { twoFactorPendingSecret: initResult.secret },
      });
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.enable('user-1', code);
      expect(result.enabled).toBe(true);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              twoFactorEnabled: true,
              twoFactorSecret: initResult.secret,
            }),
          }),
        }),
      );
    });

    it('rejects an invalid code', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        metadata: { twoFactorPendingSecret: 'JBSWY3DPEHPK3PXP' },
      });

      await expect(service.enable('user-1', '000000')).rejects.toThrow(/Invalid code/);
    });

    it('throws when not initialized', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ metadata: {} });
      await expect(service.enable('user-1', '123456')).rejects.toThrow(/not initialized/);
    });

    it('throws when already enabled', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        metadata: { twoFactorEnabled: true, twoFactorSecret: 'XXX' },
      });
      await expect(service.enable('user-1', '123456')).rejects.toThrow(/already enabled/);
    });
  });

  describe('disable()', () => {
    it('disables when password is correct', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        passwordHash: '$2a$10$...',
        metadata: { twoFactorEnabled: true, twoFactorSecret: 'XXX' },
      });
      passwordServiceMock.compare.mockResolvedValue(true);
      prismaMock.user.update.mockResolvedValue({});

      const result = await service.disable('user-1', 'correct-password');
      expect(result.enabled).toBe(false);
      expect(prismaMock.user.update).toHaveBeenCalled();
    });

    it('rejects when password is wrong', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        passwordHash: '$2a$10$...',
        metadata: { twoFactorEnabled: true },
      });
      passwordServiceMock.compare.mockResolvedValue(false);

      await expect(service.disable('user-1', 'wrong')).rejects.toThrow(/incorrect/);
    });

    it('rejects SSO users (no password set)', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        passwordHash: null,
        metadata: {},
      });
      await expect(service.disable('user-1', 'whatever')).rejects.toThrow(/single sign-on/);
    });
  });

  describe('verifyChallenge() (login-time check)', () => {
    it('passes through when 2FA disabled', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ metadata: {} });
      expect(await service.verifyChallenge('user-1', null)).toBe(true);
    });

    it('requires code when enabled but no code supplied', async () => {
      prismaMock.user.findUnique.mockResolvedValue({
        metadata: { twoFactorEnabled: true, twoFactorSecret: 'JBSWY3DPEHPK3PXP' },
      });
      expect(await service.verifyChallenge('user-1', null)).toBe(false);
    });

    it('verifies code when enabled', async () => {
      const { totpAt } = require('../totp.util');
      const secret = 'JBSWY3DPEHPK3PXP';
      const code = totpAt(secret);
      prismaMock.user.findUnique.mockResolvedValue({
        metadata: { twoFactorEnabled: true, twoFactorSecret: secret },
      });
      expect(await service.verifyChallenge('user-1', code)).toBe(true);
    });
  });
});
