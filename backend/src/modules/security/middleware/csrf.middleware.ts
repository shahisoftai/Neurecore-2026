/**
 * ═══════════════════════════════════════════════════════════════════════════
 * CSRF Protection Middleware
 * ═══════════════════════════════════════════════════════════════════════════
 * Implements CSRF token validation for state-changing requests.
 * Uses double-submit cookie pattern for stateless CSRF protection.
 */

import {
  Injectable,
  NestMiddleware,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);
  private readonly csrfCookieName = 'XSRF-TOKEN';
  private readonly csrfHeaderName = 'x-csrf-token';
  private enabled = true;

  constructor(private readonly configService: ConfigService) {
    this.enabled = this.configService.get<boolean>('CSRF_ENABLED', true);
  }

  use(req: Request, res: Response, next: NextFunction): void {
    // Skip CSRF check if disabled
    if (!this.enabled) {
      return next();
    }

    // Only check for state-changing methods
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Skip for public endpoints
    const publicPaths = ['/health', '/healthz', '/api/v1/auth/login'];
    if (publicPaths.some((path) => req.path.startsWith(path))) {
      return next();
    }

    // Get CSRF token from header
    const csrfToken = req.headers[this.csrfHeaderName] as string;

    // Get CSRF token from cookie
    const csrfCookie =
      req.cookies?.[this.csrfCookieName] ||
      this.extractCsrfFromCookie(req.headers.cookie);

    // If no token in request, try to set one for GET requests
    if (!csrfToken && req.method === 'GET') {
      this.setCsrfToken(req, res);
      return next();
    }

    // Validate CSRF token
    if (!csrfToken || !csrfCookie) {
      this.logger.warn(`CSRF token missing: ${req.method} ${req.path}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'CSRF token missing',
          error: 'Cross-site request forgery token is required',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Compare tokens (timing-safe comparison would be better in production)
    if (csrfToken !== csrfCookie) {
      this.logger.warn(`CSRF token mismatch: ${req.method} ${req.path}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.FORBIDDEN,
          message: 'CSRF token invalid',
          error: 'Cross-site request forgery token is invalid',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Set CSRF token for response
    this.setCsrfToken(req, res);

    next();
  }

  /**
   * Extract CSRF token from cookie header
   */
  private extractCsrfFromCookie(
    cookieHeader: string | undefined,
  ): string | null {
    if (!cookieHeader) {
      return null;
    }

    const cookies = cookieHeader.split(';').map((c) => c.trim());
    for (const cookie of cookies) {
      const [name, value] = cookie.split('=');
      if (name === this.csrfCookieName) {
        return decodeURIComponent(value);
      }
    }

    return null;
  }

  /**
   * Set CSRF token in response cookie
   */
  private setCsrfToken(req: Request, res: Response): void {
    // Check if token already exists in request
    let csrfToken = (req as any).csrfToken as string;

    if (!csrfToken) {
      // Generate new token
      csrfToken = uuidv4();
    }

    // Set cookie with httpOnly=false so JavaScript can read it
    const isProduction =
      this.configService.get<string>('NODE_ENV') === 'production';

    res.cookie(this.csrfCookieName, csrfToken, {
      httpOnly: false, // Allow JavaScript access for double-submit pattern
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });

    // Also set on request for use in controllers
    (req as any).csrfToken = csrfToken;
  }
}
