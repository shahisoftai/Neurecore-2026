import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UseGuards,
  Get,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { ApiCommon } from '../../../common/decorators/api-common.decorator';
import { AuthService } from '../services/auth.service';
import { RegisterDto } from '../dto/register.dto';
import { LoginDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { GoogleSignInDto } from '../dto/google-signin.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { Public } from '../../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import type { ValidatedUser } from '../interfaces/auth.interface';
import type { Request, Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { CookieAuthService } from '../../../common/auth/cookie-auth.service';

/**
 * AuthController — Phase 9 update (Auth Hardening).
 *
 * Per `EAOS-implementation-roadmap.md` §13 + `EAOS-api-contract.md` §4.1.
 *
 * Cookie semantics:
 *   - `POST /auth/login`        → 200 + Set-Cookie `__Host-nc_at` + `__Host-nc_rt` + `__Host-nc_csrf` (NOT httpOnly)
 *   - `POST /auth/register`     → 200 + same cookies (per EAOS-pricing-plans.md v1.2 self-signup)
 *   - `POST /auth/google`       → 200 + same cookies (Google OAuth sign-in)
 *   - `POST /auth/refresh`      → 200 + rotated cookies; refresh token read from cookie OR body
 *   - `POST /auth/logout`       → 204 + clears all three cookies + revokes tokens
 *
 * The response body still contains `accessToken` + `refreshToken` for
 * server-to-server / CLI / explicit Bearer usage. The SPA should rely on
 * cookies (and not store the tokens).
 */
@ApiCommon('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  private readonly googleClientId: string;

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly cookieAuth: CookieAuthService,
  ) {
    this.googleClientId = this.configService.get<string>('GOOGLE_CLIENT_ID', '');
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.register({
      email: dto.email,
      password: dto.password,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: dto.role,
      tenantId: dto.tenantId,
    });
    this.attachAuthCookies(res, result.tokens);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.logger.debug(`Login attempt: ${JSON.stringify(dto)}`);
    const result = await this.authService.login(dto.email, dto.password, {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    this.attachAuthCookies(res, result.tokens);
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('google')
  @HttpCode(HttpStatus.OK)
  async googleSignIn(
    @Body() dto: GoogleSignInDto & { intent?: 'signin' | 'link' },
    @Res({ passthrough: true }) res: Response,
  ) {
    const payload = await this.verifyGoogleToken(dto.idToken);
    const result = await this.authService.googleSignIn(
      {
        googleId: payload.sub,
        email: payload.email,
        firstName: payload.given_name,
        lastName: payload.family_name,
        googlePicture: payload.picture,
      },
      { intent: dto.intent ?? 'signin' },
    );
    if (result.status === 'ok' && result.tokens) {
      this.attachAuthCookies(res, result.tokens);
    }
    return result;
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Phase 9: read refresh token from cookie first, fall back to body.
    const { refreshToken: cookieRefresh } = this.cookieAuth.parseCookies(req);
    const bodyRefresh = dto?.refreshToken;
    const refreshToken = cookieRefresh || bodyRefresh;
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token missing');
    }
    const tokens = await this.authService.refresh(refreshToken);
    this.attachAuthCookies(res, tokens);
    return tokens;
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @CurrentUser() user: ValidatedUser & { jti?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.id, user.jti ?? '');
    this.cookieAuth.clearAuthCookies(res);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@CurrentUser() user: ValidatedUser) {
    return user;
  }

  /** Alias for /me — satisfies spec requirement for GET /auth/profile */
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  profile(@CurrentUser() user: ValidatedUser) {
    return user;
  }

  /**
   * Attach auth cookies to the response. Called from login/register/google/refresh.
   * No-op if the feature flag is OFF (so dev environments without HTTPS still work
   * — but the cookies still wouldn't be set anyway, just defensive).
   */
  private attachAuthCookies(
    res: Response,
    tokens: { accessToken: string; refreshToken: string },
  ): void {
    if (!this.cookieAuth.isEnabled()) return;
    this.cookieAuth.setAuthCookies(res, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    });
  }

  private async verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload> {
    const res = await fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
    );
    if (!res.ok) {
      throw new UnauthorizedException('Invalid Google ID token');
    }
    const payload = (await res.json()) as GoogleTokenPayload;
    if (payload.aud !== this.googleClientId) {
      throw new UnauthorizedException('Google ID token audience mismatch');
    }
    return payload;
  }
}

interface GoogleTokenPayload {
  sub: string;
  email: string;
  given_name: string;
  family_name: string;
  picture?: string;
  aud: string;
}