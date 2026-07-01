/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Rate Limit Middleware
 * ═══════════════════════════════════════════════════════════════════════════
 * Applies rate limiting to requests using the RateLimitService.
 * Follows SOLID principles - Single Responsibility for rate limiting middleware.
 */

import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { RateLimitService } from '../services/rate-limit.service';
import { ThrottlerGuard } from '../guards/throttler.guard';

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  private readonly logger = new Logger(RateLimitMiddleware.name);

  constructor(
    private readonly rateLimitService: RateLimitService,
    private readonly throttlerGuard: ThrottlerGuard,
  ) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Extract client IP
    const clientIp = this.extractClientIp(req);

    // Determine rate limit based on endpoint
    const limit = this.getRateLimitForEndpoint(req.path);

    try {
      const result = await this.rateLimitService.consume(
        clientIp,
        1,
        limit,
        60000,
      );

      // Add rate limit headers
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', result.remaining);
      res.setHeader(
        'X-RateLimit-Reset',
        new Date(result.resetTime).toISOString(),
      );

      if (!result.allowed) {
        if (result.retryAfter) {
          res.setHeader('Retry-After', result.retryAfter);
        }

        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: 'Too many requests',
            error: 'Rate limit exceeded. Please try again later.',
            retryAfter: result.retryAfter,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      // If rate limiting fails, allow the request (fail open)
      this.logger.warn(
        `Rate limiting failed, allowing request: ${String(error)}`,
      );
    }

    next();
  }

  /**
   * Extract client IP from request
   */
  private extractClientIp(req: Request): string {
    // Check X-Forwarded-For header
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
      const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
        .split(',')
        .map((ip) => ip.trim());
      return ips[0];
    }

    // Check X-Real-IP header
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to socket
    return (
      (req.ip as string) || (req.socket?.remoteAddress as string) || 'unknown'
    );
  }

  /**
   * Get rate limit based on endpoint
   */
  private getRateLimitForEndpoint(path: string): number {
    // Auth endpoints - stricter limits
    if (path.includes('/auth/login') || path.includes('/auth/register')) {
      return 5;
    }

    // File upload - stricter limits
    if (path.includes('/upload') || path.includes('/file')) {
      return 5;
    }

    // API endpoints - moderate limits
    if (path.startsWith('/api/')) {
      return 100;
    }

    // Default
    return 60;
  }
}
