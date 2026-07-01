/**
 * Request Logger Middleware for NeureCore Backend
 *
 * A comprehensive request logging middleware following SOLID principles:
 * - Single Responsibility: Handles request/response logging
 * - Open/Closed: Easy to extend with new logging formats
 *
 * Features:
 * - Structured logging for production
 * - Request/response timing
 * - Correlation ID tracking
 * - Sensitive data sanitization
 */

import {
  Injectable,
  NestMiddleware,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { LoggingService, LogLevel } from '../logging';

/**
 * RequestLoggerMiddleware — logs every HTTP request with method/path/status/ms.
 * Plugged into AppModule globally via configure(consumer).
 */
@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger: Logger;
  private readonly isProduction: boolean;

  constructor(
    @Optional() @Inject(LoggingService) private loggingService?: LoggingService,
  ) {
    this.logger = new Logger('HTTP');
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  use(req: Request, res: Response, next: NextFunction): void {
    const { method, originalUrl, ip, headers } = req;

    // Get correlation ID from header or generate new one
    const correlationId = (headers['x-correlation-id'] as string) || uuidv4();
    const requestId = (headers['x-request-id'] as string) || correlationId;

    // Start timing
    const start = Date.now();

    // Get user and tenant info from request (if available)
    const userId = (req as Request & { user?: { id?: string } }).user?.id;
    const tenantId = headers['x-tenant-id'] as string;

    // Log incoming request
    this.logRequest({
      method,
      url: originalUrl,
      headers: this.sanitizeHeaders(headers),
      correlationId,
      requestId,
      userId,
      tenantId,
    });

    // Capture response
    res.on('finish', () => {
      const ms = Date.now() - start;
      const { statusCode } = res;

      this.logResponse({
        method,
        url: originalUrl,
        statusCode,
        duration: ms,
        correlationId,
        requestId,
        userId,
        tenantId,
      });
    });

    // Add correlation ID to response headers
    res.setHeader('X-Correlation-ID', correlationId);
    res.setHeader('X-Request-ID', requestId);

    next();
  }

  /**
   * Log incoming request
   */
  private logRequest(params: {
    method: string;
    url: string;
    headers: Record<string, unknown>;
    correlationId: string;
    requestId: string;
    userId?: string;
    tenantId?: string;
  }): void {
    if (this.loggingService) {
      this.loggingService.logWithRequest(
        `${params.method} ${params.url} - Incoming request`,
        LogLevel.INFO,
        {
          correlationId: params.correlationId,
          requestId: params.requestId,
          userId: params.userId,
          tenantId: params.tenantId,
          metadata: {
            type: 'request',
            method: params.method,
            url: params.url,
            headers: params.headers,
          },
        },
      );
    } else {
      this.logger.log(
        `[${params.correlationId}] ${params.method} ${params.url} - Incoming request`,
      );
    }
  }

  /**
   * Log outgoing response
   */
  private logResponse(params: {
    method: string;
    url: string;
    statusCode: number;
    duration: number;
    correlationId: string;
    requestId: string;
    userId?: string;
    tenantId?: string;
  }): void {
    const level = this.getLogLevel(params.statusCode);
    const message = `${params.method} ${params.url} ${params.statusCode} ${params.duration}ms`;

    if (this.loggingService) {
      this.loggingService.logWithRequest(message, level, {
        correlationId: params.correlationId,
        requestId: params.requestId,
        userId: params.userId,
        tenantId: params.tenantId,
        metadata: {
          type: 'response',
          statusCode: params.statusCode,
          duration: params.duration,
        },
      });
    } else {
      this.logger[
        level === LogLevel.ERROR
          ? 'error'
          : level === LogLevel.WARN
            ? 'warn'
            : 'log'
      ](`[${params.correlationId}] ${message}`);
    }
  }

  /**
   * Determine log level based on status code
   */
  private getLogLevel(statusCode: number): LogLevel {
    if (statusCode >= 500) return LogLevel.ERROR;
    if (statusCode >= 400) return LogLevel.WARN;
    return LogLevel.INFO;
  }

  /**
   * Sanitize sensitive headers
   */
  private sanitizeHeaders(
    headers: Record<string, unknown>,
  ): Record<string, unknown> {
    const sensitiveHeaders = [
      'authorization',
      'cookie',
      'x-api-key',
      'x-auth-token',
    ];

    const sanitized = { ...headers };

    for (const header of sensitiveHeaders) {
      if (sanitized[header]) {
        sanitized[header] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
