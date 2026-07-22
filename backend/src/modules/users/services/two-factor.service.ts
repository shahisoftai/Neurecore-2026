/**
 * two-factor.service.ts — 2FA enable/disable for users.
 *
 * The TOTP secret is stored under User.metadata.twoFactorSecret.
 * The enable flag lives under User.metadata.twoFactorEnabled.
 *
 * Uses the in-house RFC 6238 implementation (../services/totp.util).
 * No external dependency on otplib, speakeasy, etc.
 *
 * SECURITY:
 * - Secret generated via crypto.randomBytes (CSPRNG).
 * - The flag/secret are stored under metadata — not separate columns — to
 *   avoid a DB migration while shipping the feature.
 * - Future hardening: move to dedicated columns (User.twoFactorSecret,
 *   User.twoFactorEnabled) when the team is ready for a Prisma migration.
 */

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PasswordService } from '../../auth/services/password.service';
import { generateTotpSecret, verifyTotp, buildOtpauthUri } from './totp.util';

@Injectable()
export class TwoFactorService {
  private readonly logger = new Logger(TwoFactorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
  ) {}

  /**
   * GET /me/security/2fa — read current 2FA status.
   */
  async getStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });
    if (!user) throw new BadRequestException('User not found');
    const meta = (user.metadata ?? {}) as Record<string, unknown>;
    return {
      enabled: Boolean(meta.twoFactorEnabled),
      hasSecret: Boolean(meta.twoFactorSecret),
      lastChallengeAt: meta.last2FAChallengeAt ?? null,
    };
  }

  /**
   * POST /me/security/2fa/init — generate a fresh secret.
   * Stores pending secret under User.metadata.twoFactorPendingSecret.
   * The user scans the QR, then POSTs the TOTP code to /enable.
   */
  async init(userId: string, issuer = 'NeureCore') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, metadata: true },
    });
    if (!user) throw new BadRequestException('User not found');

    const meta = (user.metadata ?? {}) as Record<string, unknown>;
    if (meta.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled. Disable first.');
    }

    const secret = generateTotpSecret();
    const metaWithPending = {
      ...meta,
      twoFactorPendingSecret: secret,
      twoFactorPendingIssuedAt: new Date().toISOString(),
    };
    await this.prisma.user.update({
      where: { id: userId },
      data: { metadata: metaWithPending as never },
    });

    return {
      secret, // base32, for manual entry in authenticator
      otpauthUri: buildOtpauthUri({
        issuer,
        accountName: user.email,
        secretBase32: secret,
      }),
      // Caller's authenticator app will render this as a QR.
      // The frontend should render as: "otpauth://totp/...."
    };
  }

  /**
   * POST /me/security/2fa/enable — verify code + flip the flag.
   * Reads twoFactorPendingSecret (set by /init), verifies the user-supplied
   * code against it, then promotes to twoFactorSecret and sets the flag.
   */
  async enable(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });
    if (!user) throw new BadRequestException('User not found');
    const meta = (user.metadata ?? {}) as Record<string, unknown>;
    if (meta.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled.');
    }
    const pendingSecret = meta.twoFactorPendingSecret as string | undefined;
    if (!pendingSecret) {
      throw new BadRequestException('2FA not initialized. Call /init first.');
    }
    if (!verifyTotp(pendingSecret, code)) {
      throw new BadRequestException(
        'Invalid code. Try again with the current code in your authenticator.',
      );
    }
    // Promote pending → active
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {
      twoFactorPendingSecret: _pending,
      twoFactorPendingIssuedAt: _issued,
      ...rest
    } = meta;
    const updated = {
      ...rest,
      twoFactorSecret: pendingSecret,
      twoFactorEnabled: true,
      twoFactorEnabledAt: new Date().toISOString(),
    };
    await this.prisma.user.update({
      where: { id: userId },
      data: { metadata: updated as never },
    });
    this.logger.log(`2FA enabled for user ${userId}`);
    return { enabled: true };
  }

  /**
   * POST /me/security/2fa/disable — require password to disable.
   */
  async disable(userId: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true, passwordHash: true },
    });
    if (!user) throw new BadRequestException('User not found');
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Account has no password (single sign-on) — disable via SSO provider.',
      );
    }
    const valid = await this.passwordService.compare(
      password,
      user.passwordHash,
    );
    if (!valid) throw new BadRequestException('Password is incorrect.');
    const meta = (user.metadata ?? {}) as Record<string, unknown>;
    const updated = { ...meta };
    delete updated.twoFactorSecret;
    delete updated.twoFactorPendingSecret;
    delete updated.twoFactorEnabled;
    delete updated.twoFactorEnabledAt;
    updated.twoFactorDisabledAt = new Date().toISOString();
    await this.prisma.user.update({
      where: { id: userId },
      data: { metadata: updated as never },
    });
    this.logger.log(`2FA disabled for user ${userId}`);
    return { enabled: false };
  }

  /**
   * Internal helper used by login/refresh flows to verify a 2FA challenge.
   * Returns true if 2FA is satisfied (either disabled on this user, or the
   * supplied code matches the stored secret).
   */
  async verifyChallenge(userId: string, code: string | null): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { metadata: true },
    });
    if (!user) return false;
    const meta = (user.metadata ?? {}) as Record<string, unknown>;
    if (!meta.twoFactorEnabled) return true; // 2FA not enabled — pass through
    if (!code) return false;
    const secret = meta.twoFactorSecret as string | undefined;
    if (!secret) return false;
    return verifyTotp(secret, code);
  }
}
