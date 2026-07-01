/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Input Sanitization Middleware
 * ═══════════════════════════════════════════════════════════════════════════
 * Sanitizes request body, query, and parameters to prevent XSS attacks.
 * Follows SOLID principles - Single Responsibility for input sanitization.
 */

import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InputSanitizationService } from '../services/input-sanitization.service';

@Injectable()
export class SanitizationMiddleware implements NestMiddleware {
  private readonly logger = new Logger(SanitizationMiddleware.name);

  constructor(private readonly sanitizationService: InputSanitizationService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Sanitize request body
    if (req.body && typeof req.body === 'object') {
      req.body = this.sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && typeof req.query === 'object') {
      req.query = this.sanitizeObject(req.query) as unknown as any;
    }

    // Sanitize URL parameters
    if (req.params) {
      req.params = this.sanitizeObject(req.params) as Record<string, string>;
    }

    next();
  }

  /**
   * Recursively sanitize an object
   */
  private sanitizeObject(
    obj: Record<string, unknown>,
  ): Record<string, unknown> {
    if (!obj || typeof obj !== 'object') {
      return obj;
    }

    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value === null || value === undefined) {
        result[key] = value;
      } else if (typeof value === 'string') {
        // Sanitize string values
        const sanitized = this.sanitizationService.sanitizeXss(value);

        // Check for malicious patterns
        if (this.sanitizationService.detectSqlInjection(sanitized)) {
          this.logger.warn(`SQL injection attempt detected in ${key}: ${key}`);
        }

        if (this.sanitizationService.detectXss(sanitized)) {
          this.logger.warn(`XSS attempt detected in ${key}: ${key}`);
        }

        result[key] = sanitized;
      } else if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === 'string'
            ? this.sanitizationService.sanitizeXss(item)
            : typeof item === 'object'
              ? this.sanitizeObject(item as Record<string, unknown>)
              : item,
        );
      } else if (typeof value === 'object') {
        result[key] = this.sanitizeObject(value as Record<string, unknown>);
      } else {
        // For numbers, booleans, etc., check if they might be suspicious
        result[key] = value;
      }
    }

    return result;
  }
}
