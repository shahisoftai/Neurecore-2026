import { UnauthorizedException } from '@nestjs/common';
import { TokenService } from '../../src/modules/auth/services/token.service';

/**
 * Regression tests for TokenService.rotateRefreshToken.
 *
 * Covers:
 *  - 401 (not 500) on unknown refresh token (FIX-007)
 *  - 401 (not 500) on expired refresh token (FIX-007)
 *  - NO cascade-revoke on a single invalid token (FIX-007)
 *  - Successful rotation revokes old token and issues a new pair
 */

const mockJwt = {
  signAsync: jest.fn().mockImplementation(async (payload: unknown) =>
    `jwt:${JSON.stringify(payload)}`,
  ),
  verifyAsync: jest.fn(),
};

const mockConfig = {
  get: jest.fn((key: string) => {
    if (key === 'JWT_ACCESS_EXPIRES') return '15m';
    if (key === 'JWT_REFRESH_EXPIRES') return '7d';
    return undefined;
  }),
};

const mockRedis = {
  blacklistToken: jest.fn().mockResolvedValue(undefined),
};

const mockPrisma = {
  refreshToken: {
    create: jest.fn().mockResolvedValue({}),
    findFirst: jest.fn(),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
  },
};

const mockSecrets = {
  getJwtSecret: jest.fn(() => 'test-secret'),
};

function makeService() {
  return new TokenService(
    mockJwt as never,
    mockConfig as never,
    mockRedis as never,
    mockPrisma as never,
    mockSecrets as never,
  );
}

const VALIDATED_USER = {
  id: 'u1',
  email: 'u@test.local',
  role: 'USER',
  tenantId: 't1',
} as never;

describe('TokenService.rotateRefreshToken (FIX-007)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws UnauthorizedException (401) — not generic Error (500) — when no stored token matches', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue(null);
    const svc = makeService();

    await expect(svc.rotateRefreshToken('rt-unknown', VALIDATED_USER)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('throws UnauthorizedException when stored token is expired', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt1',
      tokenHash: 'h',
      userId: 'u1',
      isRevoked: false,
      expiresAt: new Date(Date.now() - 60_000),
    });
    const svc = makeService();

    await expect(svc.rotateRefreshToken('rt-expired', VALIDATED_USER)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('does NOT call revokeAllRefreshTokens on a single invalid attempt (cascade-revoke regression)', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue(null);
    const svc = makeService();

    await expect(svc.rotateRefreshToken('rt-bad', VALIDATED_USER)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  it('rotates token and issues new pair when stored token is valid', async () => {
    mockPrisma.refreshToken.findFirst.mockResolvedValue({
      id: 'rt1',
      tokenHash: 'h',
      userId: 'u1',
      isRevoked: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    mockPrisma.refreshToken.create.mockResolvedValue({});
    const svc = makeService();

    const pair = await svc.rotateRefreshToken('rt-valid', VALIDATED_USER);
    expect(pair.accessToken).toMatch(/^jwt:/);
    expect(pair.refreshToken).toMatch(/^jwt:/);
    expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'rt1' },
      data: { isRevoked: true },
    });
    expect(mockPrisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });
});