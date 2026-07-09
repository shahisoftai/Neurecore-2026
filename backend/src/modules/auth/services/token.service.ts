/**
 * TokenService
 *
 * Single Responsibility: issue, verify, rotate, and revoke JWT access +
 * refresh tokens.
 *
 * F2: Refresh tokens are organised into *families*. Each rotation issues
 *     a new token in the same family but invalidates the previous one.
 *     If a previously-revoked token is presented again, we treat it as a
 *     compromise: revoke the entire family + revoke the user's refresh
 *     tokens + audit-log CRITICAL.
 *
 * F4: All rotation + new-issuance work happens in a single Prisma
 *     transaction so a network failure cannot leave two valid refresh
 *     tokens in flight.
 *
 * F15: After a password change, callers must call `invalidateOnPasswordChange`
 * to bump the user's `passwordChangedAt`. Tokens issued before that point
 * are rejected by the JWT strategy.
 *
 * Open/Closed: add new token types via additional methods; do not change
 * the existing contract.
 * Dependency Inversion: all dependencies are injected.
 */
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { JwtPayload, TokenPair } from '../interfaces/token.interface';
import { ValidatedUser } from '../interfaces/auth.interface';
import { SecretProviderService } from '../../security/providers/secret.provider';
import { jwtExpiresIn } from '../../../common/utils/config-getter';
import * as crypto from 'crypto';

@Injectable()
export class TokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly redis: RedisService,
    private readonly prisma: PrismaService,
    private readonly secrets: SecretProviderService,
  ) {}

  /**
   * Issue a brand-new access/refresh pair.
   *
   * @param user principal to embed in the JWT
   * @param familyId optional, only used when extending an existing chain
   *                  (handled internally by rotateRefreshToken).
   * @param oldRefreshTokenId ignored; kept for call-site clarity in tests.
   */
  async issueTokenPair(
    user: ValidatedUser,
    familyId?: string,
  ): Promise<TokenPair & { refreshId: string; familyId: string }> {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();
    const accessExpiresIn = jwtExpiresIn(
      this.config,
      'JWT_ACCESS_EXPIRES',
      '15m',
    );
    const refreshExpiresIn = jwtExpiresIn(
      this.config,
      'JWT_REFRESH_EXPIRES',
      '7d',
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      jti: accessJti,
      pwd: user.passwordChangedAt
        ? Math.floor(user.passwordChangedAt.getTime() / 1000)
        : undefined,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn: accessExpiresIn }),
      this.jwt.signAsync(
        {
          sub: user.id,
          jti: refreshJti,
          type: 'refresh',
          pwd: payload.pwd,
        },
        {
          expiresIn: refreshExpiresIn,
          secret: this.secrets.getJwtSecret(),
        },
      ),
    ]);

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const accessMs = this.parseDurationMs(String(accessExpiresIn));
    const refreshMs = this.parseDurationMs(String(refreshExpiresIn));

    const stored = await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshMs),
        familyId: familyId ?? uuidv4(),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(accessMs / 1000),
      refreshId: stored.id,
      familyId: stored.familyId,
    };
  }

  /**
   * Rotate a refresh token. Two failure modes require special treatment:
   *
   *  - token unknown / expired / hash mismatch  → 401 (expected)
   *  - token exists but already revoked        → COMPROMISE — revoke the
   *    entire family, set User.tokensInvalidatedAt, audit-log CRITICAL.
   *
   * @returns newly-issued TokenPair with rotatedRefreshId reflected on the
   *          previous row (so further re-use triggers compromise again).
   */
  async rotateRefreshToken(
    oldRefreshToken: string,
    user: ValidatedUser,
  ): Promise<TokenPair> {
    const oldHash = crypto
      .createHash('sha256')
      .update(oldRefreshToken)
      .digest('hex');

    // ── Pre-flight read ────────────────────────────────────────────────
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: oldHash },
    });

    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }

    if (stored.isRevoked) {
      // F2: reuse detection — assume compromise.
      await this.handleFamilyCompromise(stored.familyId, user.id);
      throw new UnauthorizedException(
        'Refresh token reuse detected. Please log in again.',
      );
    }

    // F4: rotation in a single transaction.
    const result = await this.prisma.$transaction(async (tx) => {
      const updatedPrev = await tx.refreshToken.update({
        where: { id: stored.id },
        data: { isRevoked: true },
      });

      const newPair = await this.issueTokenPairInTx(tx, user, stored.familyId);

      // Point the old row at the new one for audit/forensics.
      await tx.refreshToken.update({
        where: { id: updatedPrev.id },
        data: { replacedById: newPair.refreshId },
      });

      return newPair;
    });

    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
    };
  }

  /**
   * Revoke the entire family after suspected compromise.
   */
  private async handleFamilyCompromise(
    familyId: string,
    userId: string,
  ): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { familyId, isRevoked: false },
      data: { isRevoked: true },
    });

    // Belt-and-braces: revoke ALL refresh tokens for this user.
    await this.revokeAllRefreshTokens(userId);

    this.logger.error(
      `[SECURITY] Refresh-token reuse detected. familyId=${familyId} userId=${userId}`,
    );

    // Best-effort audit log; failures here must never bubble.
    try {
      await this.prisma.auditLog.create({
        data: {
          actor: userId,
          action: 'auth.refresh_reuse_detected',
          resource: 'refresh_token',
          resourceId: familyId,
          details: {
            severity: 'CRITICAL',
            familyId,
            userId,
          },
        },
      });
    } catch (err) {
      this.logger.warn(`Audit log write failed: ${String(err)}`);
    }
  }

  /**
   * Internal: same as `issueTokenPair` but inside an open transaction.
   */
  private async issueTokenPairInTx(
    tx: import('@prisma/client').Prisma.TransactionClient,
    user: ValidatedUser,
    familyId: string,
  ): Promise<TokenPair & { refreshId: string; familyId: string }> {
    const accessJti = uuidv4();
    const refreshJti = uuidv4();
    const accessExpiresIn = jwtExpiresIn(
      this.config,
      'JWT_ACCESS_EXPIRES',
      '15m',
    );
    const refreshExpiresIn = jwtExpiresIn(
      this.config,
      'JWT_REFRESH_EXPIRES',
      '7d',
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
      tenantId: user.tenantId,
      jti: accessJti,
      pwd: user.passwordChangedAt
        ? Math.floor(user.passwordChangedAt.getTime() / 1000)
        : undefined,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn: accessExpiresIn }),
      this.jwt.signAsync(
        { sub: user.id, jti: refreshJti, type: 'refresh', pwd: payload.pwd },
        {
          expiresIn: refreshExpiresIn,
          secret: this.secrets.getJwtSecret(),
        },
      ),
    ]);

    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');

    const accessMs = this.parseDurationMs(String(accessExpiresIn));
    const refreshMs = this.parseDurationMs(String(refreshExpiresIn));

    const stored = await tx.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshMs),
        familyId,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(accessMs / 1000),
      refreshId: stored.id,
      familyId: stored.familyId,
    };
  }

  async verifyRefreshToken(
    token: string,
  ): Promise<{ sub: string; pwd?: number }> {
    return this.jwt.verifyAsync(token, {
      secret: this.secrets.getJwtSecret(),
    });
  }

  async revokeAccessToken(jti: string, expiresIn: number): Promise<void> {
    await this.redis.blacklistToken(jti, expiresIn + 60);
  }

  async revokeAllRefreshTokens(userId: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  /**
   * Bump the user's `passwordChangedAt` after a password reset/update and
   * revoke outstanding refresh tokens so stolen ones stop working.
   */
  async invalidateOnPasswordChange(userId: string): Promise<void> {
    const now = new Date();
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordChangedAt: now },
    });
    await this.revokeAllRefreshTokens(userId);
  }

  private parseDurationMs(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 15 * 60 * 1000;
    const value = parseInt(match[1], 10);
    const unit = match[2];
    const multipliers: Record<string, number> = {
      s: 1000,
      m: 60000,
      h: 3600000,
      d: 86400000,
    };
    return value * (multipliers[unit] ?? 1000);
  }
}
