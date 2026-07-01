import { Injectable, Logger } from '@nestjs/common';
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

// Single Responsibility: issue, verify, store, and revoke tokens.
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

  async issueTokenPair(user: ValidatedUser): Promise<TokenPair> {
    const jti = uuidv4();
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
      jti,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn: accessExpiresIn }),
      this.jwt.signAsync(
        { sub: user.id, jti: uuidv4(), type: 'refresh' },
        {
          expiresIn: refreshExpiresIn,
          secret: this.secrets.getJwtSecret(),
        },
      ),
    ]);

    // Persist hashed refresh token
    const tokenHash = crypto
      .createHash('sha256')
      .update(refreshToken)
      .digest('hex');
    const refreshMs = this.parseDurationMs(String(refreshExpiresIn));

    await this.prisma.refreshToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + refreshMs),
      },
    });

    const accessMs = this.parseDurationMs(String(accessExpiresIn));

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(accessMs / 1000),
    };
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

  async rotateRefreshToken(
    oldRefreshToken: string,
    user: ValidatedUser,
  ): Promise<TokenPair> {
    const oldHash = crypto
      .createHash('sha256')
      .update(oldRefreshToken)
      .digest('hex');

    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: oldHash, isRevoked: false },
    });

    if (!stored || stored.expiresAt < new Date()) {
      // Revoke all tokens for this user — possible reuse attack
      await this.revokeAllRefreshTokens(user.id);
      throw new Error('Invalid or expired refresh token');
    }

    // Revoke old token
    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { isRevoked: true },
    });

    return this.issueTokenPair(user);
  }

  async verifyRefreshToken(token: string): Promise<{ sub: string }> {
    return this.jwt.verifyAsync(token, {
      secret: this.secrets.getJwtSecret(),
    });
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
