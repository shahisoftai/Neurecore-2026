import { UnauthorizedException, HttpException } from '@nestjs/common';
import * as crypto from 'crypto';
import { TokenService } from './token.service';
import { AccountLockoutService } from '../../security/services/account-lockout.service';
import { AuthService } from './auth.service';

/**
 * Integration-level unit tests for the Auth Hardening Batch 1 changes.
 *
 * Covers:
 *   F2: refresh-token family reuse detection → COMPROMISE on second use
 *   F3: per-account lockout triggers after repeated failures
 *   F4: rotateRefreshToken runs both writes inside a single transaction
 *   F8: validateUser runs bcrypt even when user is missing
 *  F15: tokens issued before passwordChangedAt are rejected by refresh()
 */

const REFRESH_SECRET = 'a'.repeat(50);
const TEST_REFRESH_TOKEN = 'TEST_REFRESH';
const TEST_REFRESH_HASH = crypto
  .createHash('sha256')
  .update(TEST_REFRESH_TOKEN)
  .digest('hex');

function makeJwtService() {
  return {
    signAsync: jest.fn(async (payload: Record<string, unknown>, opts?: { expiresIn?: string }) => {
      // Encode payload as a stable fake JWT-style string. Not a real JWT.
      const encoded = Buffer.from(JSON.stringify({ ...payload, _exp: opts?.expiresIn ?? '15m' }))
        .toString('base64url');
      return `fake.${encoded}.sig`;
    }),
    verifyAsync: jest.fn(async (token: string) => {
      const payload = JSON.parse(
        Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
      );
      return payload;
    }),
  };
}

function makeRedis() {
  return {
    blacklistToken: jest.fn(async () => undefined),
    isTokenBlacklisted: jest.fn(async () => false),
    incr: jest.fn(async () => 1),
    expire: jest.fn(async () => undefined),
    get: jest.fn(async () => '0'),
    del: jest.fn(async () => undefined),
    exists: jest.fn(async () => false),
  } as any;
}

function makePrisma(opts: {
  user?: any;
  refreshToken?: any;
  auditLogCalls?: number;
  invalidateRef?: jest.Mock;
  transactionResult?: any;
  familyUpdateManyCalls?: number;
}) {
  const user = opts.user ?? null;
  let refreshToken = opts.refreshToken ?? null;
  // Auto-set a valid (sha256-of-'TEST_REFRESH') hash if caller forgot.
  if (refreshToken && !refreshToken.tokenHash) {
    refreshToken = { ...refreshToken, tokenHash: TEST_REFRESH_HASH };
  }
  const invalidateRef = opts.invalidateRef ?? jest.fn(async () => ({ count: 0 }));

  return {
    refreshToken: {
      create: jest.fn(async (data: any) => ({
        id: 'rt_' + Math.random().toString(36).slice(2, 8),
        createdAt: new Date(),
        isRevoked: false,
        ...data.data,
      })),
      findUnique: jest.fn(async ({ where }: any) =>
        where?.tokenHash && refreshToken && refreshToken.tokenHash === where.tokenHash
          ? refreshToken
          : null,
      ),
      findFirst: jest.fn(async () => refreshToken),
      update: jest.fn(async ({ where, data }: any) => ({
        id: where.id,
        ...(refreshToken ?? {}),
        ...data,
      })),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    user: {
      findUnique: jest.fn(async () => user),
      findFirst: jest.fn(async () => user),
      update: jest.fn(async () => user),
    },
    auditLog: {
      create: jest.fn(async () => {
        if (opts.auditLogCalls !== undefined) opts.auditLogCalls++;
        return { id: 'al_1' };
      }),
    },
    loginAttempt: {
      create: jest.fn(async () => undefined),
    },
    session: {
      create: jest.fn(async () => undefined),
      updateMany: jest.fn(async () => ({ count: 1 })),
    },
    $transaction: jest.fn(async (cb: (tx: any) => any) => {
      if (typeof cb !== 'function') return opts.transactionResult;
      return cb({
        refreshToken: {
          create: jest.fn(async (data: any) => ({
            id: 'txRT',
            createdAt: new Date(),
            isRevoked: false,
            ...data.data,
          })),
          update: jest.fn(async ({ where, data }: any) => ({
            id: where.id,
            ...refreshToken,
            ...data,
          })),
          updateMany: jest.fn(async () => ({ count: 1 })),
        },
      });
    }),
  } as any;
}

function makePasswordService() {
  return {
    hash: jest.fn(async (s: string) => 'h:' + s),
    compare: jest.fn(async (s: string, _h: string) => s === 'good-password'),
  } as any;
}

function makeSecrets() {
  return {
    getJwtSecret: () => REFRESH_SECRET,
  } as any;
}

function makeTelemetry() {
  return {
    track: jest.fn(async () => undefined),
    timing: jest.fn(async () => undefined),
  } as any;
}

function makeCookieAuth() {
  return {
    isEnabled: () => true,
    setAuthCookies: jest.fn(),
    clearAuthCookies: jest.fn(),
    parseCookies: jest.fn(),
  } as any;
}

describe('AuthService + TokenService (Batch 1 hardening)', () => {
  // ─────────────────────────── F4 transaction ──────────────────────────────
  describe('F4: rotateRefreshToken is transactional', () => {
    it('updates old + creates new inside $transaction', async () => {
      const prisma = makePrisma({
        refreshToken: {
          id: 'rt_OLD',
          userId: 'u1',
          isRevoked: false,
          expiresAt: new Date(Date.now() + 1_000_000),
          familyId: 'fam_1',
        },
      });
      const tokens = new TokenService(
        makeJwtService() as any,
        { get: () => undefined } as any,
        makeRedis(),
        prisma,
        makeSecrets(),
      );

      const result = await tokens.rotateRefreshToken(TEST_REFRESH_TOKEN, {
        id: 'u1',
        email: 'a@b.co',
        firstName: 'A',
        lastName: 'B',
        role: 'USER' as any,
        tenantId: null,
        isActive: true,
      });

      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBeTruthy();
      expect(result.refreshToken).toBeTruthy();
    });
  });

  // ─────────────────────────── F2 reuse detection ──────────────────────────
  describe('F2: refresh-token reuse triggers compromise', () => {
    it('revokes the entire family when a revoked token is presented again', async () => {
      const prisma = makePrisma({
        refreshToken: {
          id: 'rt_REUSED',
          userId: 'u1',
          isRevoked: true, // ← the reuse flag
          expiresAt: new Date(Date.now() + 1_000_000),
          familyId: 'fam_1',
        },
        auditLogCalls: 0,
      });

      const tokens = new TokenService(
        makeJwtService() as any,
        { get: () => undefined } as any,
        makeRedis(),
        prisma,
        makeSecrets(),
      );

      await expect(
        tokens.rotateRefreshToken(TEST_REFRESH_TOKEN, {
          id: 'u1',
          email: 'a@b.co',
          firstName: 'A',
          lastName: 'B',
          role: 'USER' as any,
          tenantId: null,
          isActive: true,
        }),
      ).rejects.toThrow(UnauthorizedException);

      // Family-wide revocation was issued:
      expect(prisma.refreshToken.updateMany).toHaveBeenCalled();
      // Audit row was written:
      expect(prisma.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('a fresh, valid refresh token succeeds', async () => {
      const prisma = makePrisma({
        refreshToken: {
          id: 'rt_OK',
          userId: 'u1',
          isRevoked: false,
          expiresAt: new Date(Date.now() + 1_000_000),
          familyId: 'fam_1',
        },
      });
      const tokens = new TokenService(
        makeJwtService() as any,
        { get: () => undefined } as any,
        makeRedis(),
        prisma,
        makeSecrets(),
      );

      const out = await tokens.rotateRefreshToken(
        TEST_REFRESH_TOKEN,
        {
          id: 'u1',
          email: 'a@b.co',
          firstName: 'A',
          lastName: 'B',
          role: 'USER' as any,
          tenantId: null,
          isActive: true,
        },
      );

      expect(out.accessToken).toBeTruthy();
      expect(out.refreshToken).toBeTruthy();
    });
  });

  // ─────────────────────────── F8 constant-time ────────────────────────────
  describe('F8: validateUser always runs bcrypt', () => {
    it('invokes bcrypt.compare even when user does not exist', async () => {
      const prisma = makePrisma({ user: null });
      const password = makePasswordService();
      const tokens = {} as any; // unused here
      const telemetry = makeTelemetry();
      const cookieAuth = makeCookieAuth();
      const lockout = {
        check: jest.fn(async () => ({ allowed: true })),
        record: jest.fn(async () => undefined),
      } as any;

      const svc = new AuthService(prisma, password, tokens, telemetry, cookieAuth, lockout);

      const result = await svc.validateUser('nobody@nowhere.com', 'x');
      expect(result).toBeNull();
      expect(password.compare).toHaveBeenCalledTimes(1);
    });
  });

  // ─────────────────────────── F3 lockout ───────────────────────────────────
  describe('F3: login enforces lockout', () => {
    it('throws 429 when lockout.check rejects', async () => {
      const prisma = makePrisma({});
      const password = makePasswordService();
      const tokens = {} as any;
      const telemetry = makeTelemetry();
      const cookieAuth = makeCookieAuth();
      const lockout = {
        check: jest.fn(async () => ({
          allowed: false,
          reason: 'too_many_failures',
          retryAfterSeconds: 600,
        })),
        record: jest.fn(async () => undefined),
      } as any;

      const svc = new AuthService(prisma, password, tokens, telemetry, cookieAuth, lockout);

      await expect(
        svc.login('a@b.co', 'pw', { ipAddress: '1.1.1.1', userAgent: 'jest' }),
      ).rejects.toMatchObject({
        status: 429,
      });
      expect(lockout.check).toHaveBeenCalled();
      expect(lockout.record).toHaveBeenCalledWith(
        'a@b.co',
        false,
        expect.objectContaining({ reason: 'too_many_failures' }),
      );
    });
  });

  // ─────────────────────────── F15 passwordChangedAt ───────────────────────
  describe('F15: refresh rejects tokens issued before password change', () => {
    it('throws 401 when payload.pwd predates passwordChangedAt', async () => {
      const passwordChangedAt = new Date();
      const user = {
        id: 'u1',
        email: 'a@b.co',
        firstName: 'A',
        lastName: 'B',
        role: 'USER',
        tenantId: null,
        isActive: true,
        passwordChangedAt,
      };
      const prisma = makePrisma({ user });
      const jwt = makeJwtService();
      // Pretend the token's `pwd` claim is 1 second BEFORE passwordChangedAt:
      jest.spyOn(jwt, 'verifyAsync').mockResolvedValueOnce({
        sub: 'u1',
        pwd: Math.floor(passwordChangedAt.getTime() / 1000) - 1,
      } as any);

      const tokens = {
        verifyRefreshToken: jwt.verifyAsync.bind(jwt),
      } as any;
      const telemetry = makeTelemetry();
      const cookieAuth = makeCookieAuth();
      const lockout = {} as any;
      const password = makePasswordService();

      const svc = new AuthService(prisma, password, tokens, telemetry, cookieAuth, lockout);

      await expect(svc.refresh('OLD_TOKEN')).rejects.toThrow(/password change/i);
    });
  });
});

describe('AccountLockoutService', () => {
  it('persists a lock when thresholds are exceeded', async () => {
    const prisma = {
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValueOnce({ id: 'u1', lockedUntil: null })
          .mockResolvedValueOnce({ id: 'u1', lockedUntil: null }),
        update: jest.fn(async () => undefined),
      },
      loginAttempt: { create: jest.fn(async () => undefined) },
    } as any;
    const redis = {
      incr: jest.fn(async () => 99),
      expire: jest.fn(async () => undefined),
      get: jest.fn(async () => '99'),
      del: jest.fn(async () => undefined),
    } as any;
    const tokens = { revokeAllRefreshTokens: jest.fn(async () => undefined) } as any;

    const svc = new AccountLockoutService(prisma, redis, tokens);

    const out = await svc.check('a@b.co', '1.1.1.1');
    expect(out.allowed).toBe(false);
    expect(tokens.revokeAllRefreshTokens).toHaveBeenCalledWith('u1');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'u1' },
        data: expect.objectContaining({ lockedUntil: expect.any(Date) }),
      }),
    );
  });

  it('returns allowed when no failures recorded', async () => {
    const prisma = {
      user: {
        findUnique: jest.fn(async () => null),
        update: jest.fn(),
      },
      loginAttempt: { create: jest.fn() },
    } as any;
    const redis = {
      incr: jest.fn(async () => 0),
      expire: jest.fn(),
      get: jest.fn(async () => '0'),
      del: jest.fn(),
    } as any;
    const tokens = { revokeAllRefreshTokens: jest.fn() } as any;

    const svc = new AccountLockoutService(prisma, redis, tokens);
    const out = await svc.check('a@b.co', '1.1.1.1');
    expect(out.allowed).toBe(true);
  });
});
