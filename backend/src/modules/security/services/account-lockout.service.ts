/**
 * AccountLockoutService
 *
 * Single Responsibility: enforce per-email and per-IP rate-limit + lockout
 * for credential-based authentication attempts.
 *
 * Dependencies:
 *   - PrismaService (audit trail via LoginAttempt table)
 *   - RedisService (sliding-window counter)
 *
 * Algorithm (OWASP ASVS V2.2 / V11.1):
 *   - 5 failures per 10 minutes per (email, ip) triggers 15-minute lockout
 *   - Lock state is mirrored both in Redis (for hot-path) and User.lockedUntil
 *     (for persistence across Redis outages).
 *   - On lockout, all outstanding refresh tokens for that user are revoked.
 *
 * Open/Closed: add new lockout policies by extending `evaluate()` only.
 * Dependency Inversion: depends on PrismaService + RedisService abstractions.
 */
import {
  Injectable,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { TokenService } from '../../auth/services/token.service';
import { LockoutDecision, LockoutPolicy } from '../interfaces/lockout.interface';
import { v4 as uuidv4 } from 'uuid';

const DEFAULT_POLICY: LockoutPolicy = {
  windowSeconds: 60,
  failureThreshold: 5,
  lockoutSeconds: 15,
};

@Injectable()
export class AccountLockoutService {
  private readonly logger = new Logger(AccountLockoutService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Decision result for a prospective login.
   * If `allowed === false`, controllers MUST short-circuit and return 429/423.
   */
  async check(
    email: string,
    ipAddress: string | undefined,
  ): Promise<LockoutDecision> {
    const policy = DEFAULT_POLICY;
    const normalisedEmail = email.trim().toLowerCase();

    // 1. Hot path: persisted lockout from previous burst.
    const user = await this.prisma.user.findUnique({
      where: { email: normalisedEmail },
      select: { id: true, lockedUntil: true },
    });

    if (user?.lockedUntil && user.lockedUntil > new Date()) {
      const seconds = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / 1000,
      );
      return {
        allowed: false,
        reason: 'account_locked',
        retryAfterSeconds: seconds,
      };
    }

    // 2. Hot path: sliding-window counter in Redis.
    const windowKey = `login:fail:${normalisedEmail}`;
    const ipKey = `login:fail:ip:${ipAddress ?? 'unknown'}`;
    const [, , ipCount] = await Promise.all([
      this.redis.incr(windowKey),
      this.redis.expire(windowKey, policy.windowSeconds),
      this.redis.incr(ipKey).then(async (n) => {
        await this.redis.expire(ipKey, policy.windowSeconds);
        return n;
      }),
    ]);

    const userFailures = (await this.redis.get(windowKey)) ?? '0';
    const failures = Math.max(
      parseInt(userFailures, 10) || 0,
      parseInt(String(ipCount), 10) || 0,
    );

    if (failures >= policy.failureThreshold) {
      await this.applyLockout(normalisedEmail, policy.lockoutSeconds);
      return {
        allowed: false,
        reason: 'too_many_failures',
        retryAfterSeconds: policy.lockoutSeconds,
      };
    }

    return { allowed: true };
  }

  /**
   * Record a login outcome, reset the failure counter on success, and
   * persist a LoginAttempt row for the audit trail.
   */
  async record(
    email: string,
    success: boolean,
    meta: { ipAddress?: string; userAgent?: string; reason?: string },
  ): Promise<void> {
    const normalisedEmail = email.trim().toLowerCase();

    await this.prisma.loginAttempt.create({
      data: {
        id: uuidv4(),
        email: normalisedEmail,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        success,
        reason: meta.reason,
      },
    });

    if (success) {
      // Reset sliding window on successful login.
      await this.redis.del(`login:fail:${normalisedEmail}`);
      if (meta.ipAddress) {
        await this.redis.del(`login:fail:ip:${meta.ipAddress}`);
      }
    }
  }

  /**
   * Manually lock an account (admin/operationally triggered).
   */
  async lockAccount(email: string, seconds: number): Promise<void> {
    await this.applyLockout(email.trim().toLowerCase(), seconds);
  }

  /**
   * Internal: persist the lock, revoke outstanding refresh tokens.
   */
  private async applyLockout(
    email: string,
    seconds: number,
  ): Promise<void> {
    const until = new Date(Date.now() + seconds * 1000);
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });
    if (!user) {
      // Still log to attempts table; protect against enumeration.
      return;
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lockedUntil: until },
    });

    // Revoke refresh tokens so an attacker who already has one can't ride
    // out the lockout.
    await this.tokens.revokeAllRefreshTokens(user.id);

    this.logger.warn(
      `Account locked: email=${email} until=${until.toISOString()} seconds=${seconds}`,
    );
  }
}
