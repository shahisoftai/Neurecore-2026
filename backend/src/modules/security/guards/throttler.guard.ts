/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Throttler Guard - Rate Limiting at Application Level
 * ═══════════════════════════════════════════════════════════════════════════
 * Provides application-level rate limiting using NestJS throttler.
 * Follows SOLID principles - Single Responsibility for throttling.
 */

import { Injectable } from '@nestjs/common';
import { ThrottlerGuard as NestThrottlerGuard } from '@nestjs/throttler';

/**
 * Custom Throttler Guard
 * Extends NestJS throttler to add custom IP extraction and logging
 */
@Injectable()
export class ThrottlerGuard extends NestThrottlerGuard {
  /**
   * Extract client IP from request, handling various proxy setups
   */
  extractClientIp(request: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    socket?: { remoteAddress?: string };
  }): string {
    // Check X-Forwarded-For header (common for proxies/load balancers)
    const forwardedFor = request.headers['x-forwarded-for'];

    if (forwardedFor) {
      // Take the first IP (original client)
      const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)
        .split(',')
        .map((ip) => ip.trim());
      return ips[0];
    }

    // Check X-Real-IP header (nginx)
    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    // Fall back to socket remote address
    return (
      (request.ip as string) ||
      (request.socket?.remoteAddress as string) ||
      'unknown'
    );
  }
}
