/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Token Validation Service - JWT Token Validation and Blacklisting
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides token validation, blacklist checking, and token introspection.
 * Follows SOLID principles - Single Responsibility for token validation.
 */

import { Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { RedisService } from '../../../infrastructure/cache/redis.service';
import { SecurityEventService } from './security-event.service';
import {
  SecurityEventType,
  SecurityEventSeverity,
  ITokenPayload,
} from '../../../shared/types/security.types';

/**
 * Token validation result
 */
export interface TokenValidationResult {
  valid: boolean;
  payload?: ITokenPayload;
  error?: string;
  reason?: string;
}

@Injectable()
export class TokenValidationService implements OnModuleInit {
  private readonly logger = new Logger(TokenValidationService.name);
  private readonly blacklistPrefix = 'bl:';
  private useRedis = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    @Optional() private readonly redisService?: RedisService,
    @Optional() private readonly securityEventService?: SecurityEventService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.redisService) {
      try {
        await this.redisService.get('health:check');
        this.useRedis = true;
        this.logger.log('Token blacklist using Redis backend');
      } catch {
        this.logger.warn('Redis unavailable, using in-memory token blacklist');
      }
    }
  }

  /**
   * Validate JWT token
   */
  async validateToken(token: string): Promise<TokenValidationResult> {
    try {
      // Check if token is blacklisted
      const payload = this.jwtService.decode(token);

      if (!payload || !payload.sub) {
        return {
          valid: false,
          error: 'Invalid token format',
          reason: 'Token payload is invalid',
        };
      }

      // Check blacklist
      const isBlacklisted = await this.isTokenBlacklisted(payload.sub);
      if (isBlacklisted) {
        if (this.securityEventService) {
          await this.securityEventService.logEvent({
            type: SecurityEventType.INVALID_TOKEN,
            severity: SecurityEventSeverity.WARNING,
            message: 'Blacklisted token attempt',
            userId: payload.sub,
            metadata: { tokenId: payload.sub },
          });
        }

        return {
          valid: false,
          error: 'Token has been revoked',
          reason: 'Token is blacklisted',
        };
      }

      // Verify token signature and expiration
      try {
        const verified = this.jwtService.verify<ITokenPayload>(token);
        return {
          valid: true,
          payload: verified,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';

        if (errorMessage.includes('expired')) {
          if (this.securityEventService) {
            await this.securityEventService.logEvent({
              type: SecurityEventType.TOKEN_EXPIRED,
              severity: SecurityEventSeverity.INFO,
              message: 'Expired token attempt',
              userId: payload.sub,
            });
          }

          return {
            valid: false,
            error: 'Token has expired',
            reason: 'Token expired',
          };
        }

        return {
          valid: false,
          error: 'Invalid token signature',
          reason: 'Token verification failed',
        };
      }
    } catch (error) {
      this.logger.error('Token validation error', error);
      return {
        valid: false,
        error: 'Token validation failed',
        reason: 'Unexpected error during validation',
      };
    }
  }

  /**
   * Check if token is blacklisted
   */
  async isTokenBlacklisted(tokenId: string): Promise<boolean> {
    if (this.useRedis && this.redisService) {
      return this.redisService.isTokenBlacklisted(tokenId);
    }

    // In-memory fallback (not recommended for production)
    return false;
  }

  /**
   * Add token to blacklist
   */
  async blacklistToken(
    tokenId: string,
    expiresInSeconds: number,
  ): Promise<void> {
    if (this.useRedis && this.redisService) {
      await this.redisService.blacklistToken(tokenId, expiresInSeconds);
      this.logger.debug(`Token blacklisted: ${tokenId}`);
    } else {
      this.logger.warn('Token blacklist not available - fail open');
    }
  }

  /**
   * Extract token from authorization header
   */
  extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Validate token and extract payload
   */
  async validateAndExtract(
    authHeader: string | undefined,
  ): Promise<TokenValidationResult> {
    const token = this.extractTokenFromHeader(authHeader);

    if (!token) {
      return {
        valid: false,
        error: 'No token provided',
        reason: 'Authorization header missing or invalid format',
      };
    }

    return this.validateToken(token);
  }

  /**
   * Refresh token validation
   */
  async validateRefreshToken(
    refreshToken: string,
  ): Promise<TokenValidationResult> {
    try {
      const payload = this.jwtService.verify<ITokenPayload>(refreshToken);

      // Check if it's a refresh token (you might want to add a type check)
      if (!payload.sub) {
        return {
          valid: false,
          error: 'Invalid refresh token',
        };
      }

      return {
        valid: true,
        payload,
      };
    } catch (error) {
      return {
        valid: false,
        error: 'Invalid or expired refresh token',
        reason: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    try {
      const payload = this.jwtService.decode(token);

      if (!payload?.exp) {
        return null;
      }

      return new Date(payload.exp * 1000);
    } catch {
      return null;
    }
  }

  /**
   * Check if token expires soon (within specified seconds)
   */
  isTokenExpiringSoon(token: string, withinSeconds: number = 300): boolean {
    const expiration = this.getTokenExpiration(token);

    if (!expiration) {
      return false;
    }

    const now = new Date();
    const threshold = new Date(now.getTime() + withinSeconds * 1000);

    return expiration < threshold;
  }
}
