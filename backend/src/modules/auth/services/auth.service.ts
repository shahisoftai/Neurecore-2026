import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { randomBytes, createHash } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { PlatformEmailService } from './platform-email.service';
import { TelemetryService } from '../../observability/services/telemetry.service';
import { AccountLockoutService } from '../../security/services/account-lockout.service';
import {
  IAuthService,
  RegisterInput,
  AuthResult,
  ValidatedUser,
  RequestMeta,
  GoogleSignInInput,
  GoogleSignInResult,
} from '../interfaces/auth.interface';
import { TokenPair } from '../interfaces/token.interface';
import { UserRole } from '@prisma/client';
import { CookieAuthService } from '../../../common/auth/cookie-auth.service';

// Single Responsibility: orchestrate registration, login, refresh, logout, and
// password-reset flows.
@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly tenantFrontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly telemetry: TelemetryService,
    private readonly cookieAuth: CookieAuthService,
    private readonly lockout: AccountLockoutService,
    private readonly emailService: PlatformEmailService,
    config: ConfigService,
  ) {
    this.tenantFrontendUrl =
      config.get<string>('TENANT_FRONTEND_URL') || 'http://localhost:3001';
  }

  /**
   * F8 — constant-time user validation.
   *
   * Returns null for any authentication failure to keep the public surface
   * unchanged, but always runs a bcrypt comparison so the response time is
   * independent of whether the user exists, has a password, or is active.
   */
  async validateUser(
    email: string,
    password: string,
  ): Promise<ValidatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });

    if (!user) {
      // Run a dummy compare so timing matches the success path.
      await this.passwordService.compare(password, DUMMY_BCRYPT_HASH);
      return null;
    }

    if (!user.passwordHash) {
      // Google-only user; do not let attackers enumerate those.
      await this.passwordService.compare(password, DUMMY_BCRYPT_HASH);
      return null;
    }

    if (!user.isActive) {
      // Still run compare to keep timing parity.
      const stillValid = await this.passwordService.compare(
        password,
        user.passwordHash,
      );
      void stillValid; // ignore; user is inactive
      return null;
    }

    const valid = await this.passwordService.compare(
      password,
      user.passwordHash,
    );
    if (!valid) return null;

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return null;
    }

    return this.toValidatedUser(user);
  }

  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    let tenantId = data.tenantId ?? null;

    if (tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
      });
      if (!tenant) throw new ForbiddenException('Tenant not found');
      if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
        throw new ForbiddenException('Tenant is not active');
      }
    } else {
      const defaultTier = await this.prisma.tier.findFirst({
        where: { isDefault: true },
      });
      if (!defaultTier) {
        throw new Error('No default tier found. Please contact support.');
      }
      const domainPart = data.email.split('@')[1] ?? 'personal';
      const tenant = await this.prisma.tenant.create({
        data: {
          name:
            domainPart.split('.')[0].replace(/^\w/, (c) => c.toUpperCase()) +
            ' Workspace',
          slug: `tenant-${Date.now()}-${Math.random().toString(36).substring(7)}`,
          tierId: defaultTier.id,
        },
      });
      tenantId = tenant.id;
      this.logger.log(
        `Auto-created tenant ${tenant.id} for credential signup ${data.email}`,
      );
    }

    const passwordHash = await this.passwordService.hash(data.password);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        passwordChangedAt: new Date(),
        role:
          tenantId && !data.tenantId
            ? UserRole.OWNER
            : (data.role ?? UserRole.USER),
        tenantId,
      },
    });

    const validated = this.toValidatedUser(user);
    const tokens = await this.tokenService.issueTokenPair(validated);

    this.logger.log(`User registered: ${user.email} role=${user.role}`);
    return { user: validated, tokens };
  }

  async login(
    email: string,
    password: string,
    meta: RequestMeta,
  ): Promise<AuthResult> {
    const normalisedEmail = email.trim().toLowerCase();
    const start = Date.now();

    // F3: pre-flight lockout check.
    const lock = await this.lockout.check(normalisedEmail, meta.ipAddress);
    if (!lock.allowed) {
      await this.lockout.record(normalisedEmail, false, {
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        reason: lock.reason,
      });
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message: 'Too many login attempts. Please try again later.',
          error: 'AUTH_LOCKOUT',
          retryAfterSeconds: lock.retryAfterSeconds,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const validated = await this.validateUser(normalisedEmail, password);
    if (!validated) {
      await this.lockout.record(normalisedEmail, false, {
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        reason: 'invalid_credentials',
      });
      await this.telemetry.track('auth.login.failure', {
        labels: { reason: 'invalid_credentials', email: normalisedEmail },
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    await this.lockout.record(normalisedEmail, true, {
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const tokens = await this.tokenService.issueTokenPair(validated);

    await this.prisma.session.create({
      data: {
        userId: validated.id,
        tenantId: validated.tenantId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    });

    await this.prisma.user.update({
      where: { id: validated.id },
      data: { lastLoginAt: new Date() },
    });

    await this.telemetry.timing('auth.login.duration_ms', Date.now() - start, {
      tenantId: validated.tenantId ?? undefined,
    });
    await this.telemetry.track('auth.login.success', {
      tenantId: validated.tenantId ?? undefined,
    });

    this.logger.log(`User logged in: ${normalisedEmail}`);
    return { user: validated, tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token missing');
    }
    let payload: { sub: string; pwd?: number };
    try {
      payload = await this.tokenService.verifyRefreshToken(refreshToken);
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // F15: refresh token issued before password change is invalid.
    if (
      user.passwordChangedAt &&
      (payload.pwd === undefined ||
        payload.pwd * 1000 < user.passwordChangedAt.getTime())
    ) {
      throw new UnauthorizedException('Token invalidated by password change');
    }

    const validated = this.toValidatedUser(user);
    return this.tokenService.rotateRefreshToken(refreshToken, validated);
  }

  async logout(userId: string, jti: string): Promise<void> {
    await this.tokenService.revokeAccessToken(jti, 15 * 60);
    await this.tokenService.revokeAllRefreshTokens(userId);
    await this.prisma.session.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    });
    this.logger.log(`User logged out: ${userId}`);
  }

  async googleSignIn(
    data: GoogleSignInInput,
    options: { intent?: 'signin' | 'link' } = {},
  ): Promise<GoogleSignInResult> {
    const start = Date.now();
    const intent = options.intent ?? 'signin';

    const existingByEmail = await this.prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingByEmail) {
      if (!existingByEmail.googleId && intent !== 'link') {
        this.logger.warn(
          `Google sign-in for ${data.email} blocked — account exists without Google link. ` +
            'Returning "existing_unlinked" to prompt user.',
        );
        await this.telemetry.track('auth.google_signin.existing_unlinked');
        return {
          status: 'existing_unlinked',
          email: existingByEmail.email,
          firstName: existingByEmail.firstName,
          lastName: existingByEmail.lastName,
          googlePicture: data.googlePicture,
          googleId: data.googleId,
        };
      }

      if (!existingByEmail.googleId) {
        await this.prisma.user.update({
          where: { id: existingByEmail.id },
          data: {
            googleId: data.googleId,
            googlePicture: data.googlePicture,
          },
        });
        this.logger.log(`Google ID linked: ${data.email}`);
        await this.telemetry.track('auth.google_signin.linked');
      }
      const validated = this.toValidatedUser(existingByEmail);
      const tokens = await this.tokenService.issueTokenPair(validated);
      await this.telemetry.timing(
        'auth.google_signin.duration_ms',
        Date.now() - start,
        {
          tenantId: validated.tenantId ?? undefined,
        },
      );
      await this.telemetry.track('auth.google_signin.success', {
        tenantId: validated.tenantId ?? undefined,
      });
      this.logger.log(`User logged in via Google: ${data.email}`);
      return { status: 'ok', user: validated, tokens };
    }

    const defaultTier = await this.prisma.tier.findFirst({
      where: { isDefault: true },
    });
    if (!defaultTier) {
      throw new Error('No default tier found. Please contact support.');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name:
          data.email
            .split('@')[1]
            ?.replace('.', ' ')
            .replace(/^\w/, (c) => c.toUpperCase()) ?? 'Personal',
        slug: `tenant-${Date.now()}-${Math.random().toString(36).substring(7)}`,
        tierId: defaultTier.id,
      },
    });

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        googleId: data.googleId,
        googlePicture: data.googlePicture,
        role: UserRole.OWNER,
        tenantId: tenant.id,
        isActive: true,
        isVerified: true,
      },
    });

    const validated = this.toValidatedUser(user);
    const tokens = await this.tokenService.issueTokenPair(validated);
    await this.telemetry.timing(
      'auth.google_signin.duration_ms',
      Date.now() - start,
      {
        tenantId: tenant.id,
      },
    );
    await this.telemetry.track('auth.google_signin.new_user', {
      tenantId: tenant.id,
    });
    this.logger.log(
      `User registered via Google: ${user.email} tenant=${tenant.id}`,
    );
    return { status: 'ok', user: validated, tokens };
  }

  async requestPasswordReset(email: string): Promise<void> {
    const normalised = email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email: normalised },
    });

    // Always succeed to the caller — don't reveal whether the email exists.
    if (!user || !user.passwordHash || !user.isActive) {
      return;
    }

    // Invalidate any existing unused reset tokens for this user.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null, expiresAt: { gte: new Date() } },
      data: { expiresAt: new Date(0) },
    });

    const plain = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(plain).digest('hex');

    await this.prisma.passwordResetToken.create({
      data: {
        tokenHash,
        userId: user.id,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const resetLink = `${this.tenantFrontendUrl}/reset-password?token=${plain}`;

    await this.emailService.send({
      to: normalised,
      subject: 'Reset your NeureCore password',
      html: `
        <p>Hello ${user.firstName},</p>
        <p>We received a request to reset your NeureCore password.</p>
        <p><a href="${resetLink}">Reset your password</a></p>
        <p>This link expires in 1 hour. If you did not request this, ignore this email.</p>
        <p>— NeureCore</p>
      `,
    });

    this.logger.log(`Password reset requested for ${normalised}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const passwordHash = await this.passwordService.hash(newPassword);

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.user.id },
        data: { passwordHash, passwordChangedAt: new Date() },
      }),
    ]);

    await this.tokenService.revokeAllRefreshTokens(record.user.id);

    this.logger.log(`Password reset completed for ${record.user.email}`);
  }

  private toValidatedUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string | null;
    isActive: boolean;
    passwordChangedAt?: Date | null;
  }): ValidatedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive,
      passwordChangedAt: user.passwordChangedAt ?? null,
    };
  }
}

/**
 * Pre-computed bcrypt hash used to equalise timing for non-existing users.
 * Cost factor matches production password hashes (12). Anyone sending the
 * plaintext "no-such-user-padding" would still be rejected; the value of
 * this constant is irrelevant outside the timing channel.
 */
/**
 * Pre-computed bcrypt hash used to equalise timing for non-existing users.
 * Cost factor 12 matches production. Compared against a constant string so
 * we never log or persist the plaintext. Verified at startup.
 */
const DUMMY_BCRYPT_HASH =
  '$2a$12$WQd4.NUb0NwaKCTxS0hUeeyjjtyrPJLluNekuXo4aNDu1wGHLg0fq';
