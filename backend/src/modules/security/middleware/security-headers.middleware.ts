/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Security Headers Middleware
 * ═══════════════════════════════════════════════════════════════════════════
 * Adds security headers to all HTTP responses.
 * Implements OWASP recommendations for security headers.
 */

import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SecurityHeadersMiddleware implements NestMiddleware {
  constructor(private readonly configService: ConfigService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Content Security Policy (CSP)
    const csp = this.buildContentSecurityPolicy();
    res.setHeader('Content-Security-Policy', csp);

    // Strict-Transport-Security (HSTS)
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';
    if (isProduction) {
      res.setHeader(
        'Strict-Transport-Security',
        'max-age=31536000; includeSubDomains; preload',
      );
    }

    // X-Content-Type-Options
    res.setHeader('X-Content-Type-Options', 'nosniff');

    // X-Frame-Options
    res.setHeader('X-Frame-Options', 'DENY');

    // X-XSS-Protection (legacy but still useful)
    res.setHeader('X-XSS-Protection', '1; mode=block');

    // Referrer-Policy
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

    // Permissions-Policy
    res.setHeader(
      'Permissions-Policy',
      [
        'geolocation=()',
        'microphone=()',
        'camera=()',
        'payment=()',
        'usb=()',
        'vr=()',
      ].join(', '),
    );

    // Cache-Control for sensitive data
    if (req.path.includes('auth') || req.path.includes('api')) {
      res.setHeader(
        'Cache-Control',
        'no-store, no-cache, must-revalidate, proxy-revalidate',
      );
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
    }

    // Remove server identification
    res.removeHeader('X-Powered-By');
    res.removeHeader('Server');

    next();
  }

  /**
   * Build Content Security Policy based on environment
   */
  private buildContentSecurityPolicy(): string {
    const tenantUrl = this.configService.get<string>(
      'TENANT_FRONTEND_URL',
      'http://localhost:3001',
    );
    const adminUrl = this.configService.get<string>(
      'ADMIN_FRONTEND_URL',
      'http://localhost:3002',
    );
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    // Build CSP directives
    const directives = [
      // Default sources
      "default-src 'self'",

      // Script sources - be more restrictive in production
      isProduction
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
        : "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'unsafe-eval'",

      // Style sources
      "style-src 'self' 'unsafe-inline'",

      // Image sources
      "img-src 'self' data: https: blob:",

      // Font sources
      "font-src 'self' data:",

      // Connect sources (API calls)
      `connect-src 'self' ${new URL(tenantUrl).origin} ${new URL(adminUrl).origin}`,

      // Frame sources
      "frame-ancestors 'none'",

      // Object sources
      "object-src 'none'",

      // Base URI
      "base-uri 'self'",

      // Form action
      "form-action 'self'",

      // Frame options
      "frame-ancestors 'none'",
    ];

    return directives.join('; ');
  }
}
