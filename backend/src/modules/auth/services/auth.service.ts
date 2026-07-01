import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { PasswordService } from './password.service';
import { TokenService } from './token.service';
import { TelemetryService } from '../../observability/services/telemetry.service';
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

// Single Responsibility: orchestrate registration, login and logout flows.
// Dependency Inversion: depends on abstractions (PrismaService, PasswordService, TokenService).
@Injectable()
export class AuthService implements IAuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordService: PasswordService,
    private readonly tokenService: TokenService,
    private readonly telemetry: TelemetryService,
    private readonly cookieAuth: CookieAuthService,
  ) {}

  async validateUser(
    email: string,
    password: string,
  ): Promise<ValidatedUser | null> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user || !user.isActive) return null;

    // Google Sign-In users have no password
    if (!user.passwordHash) return null;

    const valid = await this.passwordService.compare(
      password,
      user.passwordHash ?? '',
    );
    if (!valid) return null;

    return this.toValidatedUser(user);
  }

  async register(data: RegisterInput): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({
      where: { email: data.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    if (data.tenantId) {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: data.tenantId },
      });
      if (!tenant) throw new ForbiddenException('Tenant not found');
      if (tenant.status === 'SUSPENDED' || tenant.status === 'CANCELLED') {
        throw new ForbiddenException('Tenant is not active');
      }
    }

    const passwordHash = await this.passwordService.hash(data.password);

    const user = await this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role ?? UserRole.USER,
        tenantId: data.tenantId ?? null,
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
    const start = Date.now();
    const validated = await this.validateUser(email, password);
    if (!validated) {
      await this.telemetry.track('auth.login.failure', { labels: { reason: 'invalid_credentials' } });
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.tokenService.issueTokenPair(validated);

    // Create session record
    await this.prisma.session.create({
      data: {
        userId: validated.id,
        tenantId: validated.tenantId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        expiresAt: new Date(Date.now() + tokens.expiresIn * 1000),
      },
    });

    await this.telemetry.timing('auth.login.duration_ms', Date.now() - start, {
      tenantId: validated.tenantId ?? undefined,
    });
    await this.telemetry.track('auth.login.success', {
      tenantId: validated.tenantId ?? undefined,
    });

    this.logger.log(`User logged in: ${email}`);
    return { user: validated, tokens };
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    if (!refreshToken || typeof refreshToken !== 'string') {
      throw new UnauthorizedException('Refresh token missing');
    }
    let payload: { sub: string };
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

    const validated = this.toValidatedUser(user);
    return this.tokenService.rotateRefreshToken(refreshToken, validated);
  }

  async logout(userId: string, jti: string): Promise<void> {
    // Blacklist current access token JTI so it cannot be reused
    await this.tokenService.revokeAccessToken(jti, 15 * 60); // 15 min safety window
    await this.tokenService.revokeAllRefreshTokens(userId);
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
      // WS-6.3: When user exists but Google not linked, return unlinked status
      // unless caller explicitly chose intent='link' (the "Link this account" button).
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

      // Link (if needed) and issue tokens
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
      await this.telemetry.timing('auth.google_signin.duration_ms', Date.now() - start, {
        tenantId: validated.tenantId ?? undefined,
      });
      await this.telemetry.track('auth.google_signin.success', {
        tenantId: validated.tenantId ?? undefined,
      });
      this.logger.log(`User logged in via Google: ${data.email}`);
      return { status: 'ok', user: validated, tokens };
    }

    // New user — create account + tenant
    const defaultTier = await this.prisma.tier.findFirst({
      where: { isDefault: true },
    });
    if (!defaultTier) {
      throw new Error('No default tier found. Please contact support.');
    }

    const tenant = await this.prisma.tenant.create({
      data: {
        name: data.email.split('@')[1]?.replace('.', ' ').replace(/^\w/, c => c.toUpperCase()) ?? 'Personal',
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
    await this.telemetry.timing('auth.google_signin.duration_ms', Date.now() - start, {
      tenantId: tenant.id,
    });
    await this.telemetry.track('auth.google_signin.new_user', { tenantId: tenant.id });
    this.logger.log(`User registered via Google: ${user.email} tenant=${tenant.id}`);
    return { status: 'ok', user: validated, tokens };
  }

  private toValidatedUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    tenantId: string | null;
    isActive: boolean;
  }): ValidatedUser {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      tenantId: user.tenantId,
      isActive: user.isActive,
    };
  }
}
