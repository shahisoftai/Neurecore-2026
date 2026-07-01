import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { JwtPayload } from '../interfaces/token.interface';
import { ValidatedUser } from '../interfaces/auth.interface';
import { CookieAuthService } from '../../../common/auth/cookie-auth.service';
import { readConfig } from '../../../common/utils/config-getter';
import * as passportJwt from 'passport-jwt';

/**
 * JwtStrategy — Phase 9 update (Auth Hardening).
 *
 * Token extraction priority:
 *   1. `__Host-nc_at` cookie (the new httpOnly path; preferred for frontend-eaos)
 *   2. `Authorization: Bearer <jwt>` header (kept for: server-to-server, CLI,
 *      Socket.IO handshakes that still send a Bearer, internal Nest clients)
 *
 * When the httpOnly cookie auth feature flag is OFF, only the header is honoured
 * (so dev environments can still test with curl without setting cookies).
 */

// Single Responsibility: validate JWT access tokens (cookie-first; header fallback).
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  private readonly cookieAuth: CookieAuthService;
  private readonly httpOnlyAuthEnabled: () => boolean;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    cookieAuth: CookieAuthService,
  ) {
    super({
      jwtFromRequest: (req: unknown) => JwtStrategy.extractJwt(req as never, cookieAuth),
      ignoreExpiration: false,
      secretOrKey:
        readConfig(config, 'JWT_SECRET') ?? process.env.JWT_SECRET ?? '',
    });
    this.cookieAuth = cookieAuth;
    this.httpOnlyAuthEnabled = () => cookieAuth.isEnabled();
  }

  /**
   * Custom extractor: httpOnly cookie → Bearer header → null.
   */
  private static extractJwt(
    req: {
      cookies?: Record<string, string>;
      headers?: Record<string, string | string[] | undefined>;
    } | undefined,
    cookieAuth: CookieAuthService,
  ): string | null {
    if (!req) return null;

    // 1. Try cookie FIRST — but only if the feature flag is on.
    if (cookieAuth.isEnabled()) {
      const fromCookie = cookieAuth.parseCookies(req as never).accessToken;
      if (fromCookie) return fromCookie;
    }

    // 2. Fallback: Authorization: Bearer header (server-to-server, CLI, sockets).
    const authHeader = req.headers?.authorization;
    if (typeof authHeader === 'string') {
      const m = authHeader.match(/^Bearer\s+(.+)$/i);
      if (m) return m[1];
    }
    if (Array.isArray(authHeader) && authHeader[0]) {
      const m = authHeader[0].match(/^Bearer\s+(.+)$/i);
      if (m) return m[1];
    }

    return null;
  }

  async validate(
    payload: JwtPayload,
  ): Promise<ValidatedUser & Pick<JwtPayload, 'sub' | 'jti'>> {
    // Check token blacklist (logout/revocation)
    if (await this.redis.isTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedException('Token revoked');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Note: request.user is the merged “principal + token context”.
    // Controllers can use user.id OR user.sub interchangeably.
    return {
      sub: payload.sub,
      jti: payload.jti,
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

// Keep the type import alive for clarity even though passport-jwt's ExtractJwt isn't used.
void passportJwt;