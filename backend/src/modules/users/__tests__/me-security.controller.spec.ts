/**
 * MeSecurityController — /me/security/* (2FA + session + password).
 * Verifies self-service endpoints wire correctly.
 */

import { MeSecurityController } from '../me-security.controller';
import type { JwtPayload } from '../../auth/interfaces/token.interface';

describe('MeSecurityController', () => {
  let controller: MeSecurityController;
  let twoFactorMock: any;
  let usersMock: any;
  let prismaMock: any;

  beforeEach(() => {
    twoFactorMock = {
      getStatus: jest.fn(),
      init: jest.fn(),
      enable: jest.fn(),
      disable: jest.fn(),
      verifyChallenge: jest.fn(),
    };
    usersMock = { changePassword: jest.fn() };
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
    controller = new MeSecurityController(twoFactorMock, usersMock, prismaMock);
  });

  const user: JwtPayload = {
    sub: 'user-1',
    email: 'jane@acme.com',
    role: 'OWNER' as never,
    tenantId: 'tenant-1',
    jti: 't1',
  };

  describe('GET /status', () => {
    it('returns 2FA status + sessionTimeoutMinutes', async () => {
      twoFactorMock.getStatus.mockResolvedValue({
        enabled: true,
        hasSecret: true,
        lastChallengeAt: '2026-07-22T10:00:00Z',
      });
      prismaMock.user.findUnique.mockResolvedValue({
        metadata: { sessionTimeoutMinutes: 240 },
      });

      const result = await controller.getStatus(user);
      expect(result.twoFactor.enabled).toBe(true);
      expect(result.sessionTimeoutMinutes).toBe(240);
    });

    it('defaults session timeout to 60 minutes', async () => {
      twoFactorMock.getStatus.mockResolvedValue({ enabled: false, hasSecret: false, lastChallengeAt: null });
      prismaMock.user.findUnique.mockResolvedValue({ metadata: {} });
      const result = await controller.getStatus(user);
      expect(result.sessionTimeoutMinutes).toBe(60);
    });
  });

  describe('PATCH /', () => {
    it('persists sessionTimeoutMinutes to metadata', async () => {
      prismaMock.user.findUnique.mockResolvedValue({ metadata: { unrelated: 'val' } });
      prismaMock.user.update.mockResolvedValue({});

      const result = await controller.update({ sessionTimeoutMinutes: 240 }, user);
      expect(result.sessionTimeoutMinutes).toBe(240);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-1' },
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              sessionTimeoutMinutes: 240,
              unrelated: 'val',
            }),
          }),
        }),
      );
    });
  });

  describe('POST /password', () => {
    it('delegates to UsersService.changePassword', async () => {
      usersMock.changePassword.mockResolvedValue({ message: 'OK' });
      const result = await controller.changePassword(
        { currentPassword: 'old', newPassword: 'newpassword8' },
        user,
      );
      expect(usersMock.changePassword).toHaveBeenCalledWith('user-1', {
        currentPassword: 'old',
        newPassword: 'newpassword8',
      });
      expect(result.message).toBe('OK');
    });
  });

  describe('POST /2fa/init', () => {
    it('generates a pending 2FA secret', async () => {
      twoFactorMock.init.mockResolvedValue({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUri: 'otpauth://totp/...',
      });
      const result = await controller.init2fa(user);
      expect(twoFactorMock.init).toHaveBeenCalledWith('user-1');
      expect(result.secret).toBeTruthy();
    });
  });

  describe('POST /2fa/enable', () => {
    it('validates TOTP code and flips flag', async () => {
      twoFactorMock.enable.mockResolvedValue({ enabled: true });
      const result = await controller.enable2fa({ code: '123456' }, user);
      expect(twoFactorMock.enable).toHaveBeenCalledWith('user-1', '123456');
      expect(result.enabled).toBe(true);
    });
  });

  describe('POST /2fa/disable', () => {
    it('requires password to disable', async () => {
      twoFactorMock.disable.mockResolvedValue({ enabled: false });
      const result = await controller.disable2fa({ password: 'mypassword' }, user);
      expect(twoFactorMock.disable).toHaveBeenCalledWith('user-1', 'mypassword');
      expect(result.enabled).toBe(false);
    });
  });

  describe('POST /2fa/challenge', () => {
    it('returns ok:true and tracks last challenge timestamp', async () => {
      twoFactorMock.verifyChallenge.mockResolvedValue(true);
      prismaMock.user.findUnique.mockResolvedValue({ metadata: {} });
      prismaMock.user.update.mockResolvedValue({});

      const result = await controller.challenge('123456', user);
      expect(result.ok).toBe(true);
      expect(prismaMock.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              last2FAChallengeAt: expect.any(String),
            }),
          }),
        }),
      );
    });

    it('returns ok:false without writing timestamp', async () => {
      twoFactorMock.verifyChallenge.mockResolvedValue(false);
      const result = await controller.challenge('000000', user);
      expect(result.ok).toBe(false);
      expect(prismaMock.user.update).not.toHaveBeenCalled();
    });
  });
});
