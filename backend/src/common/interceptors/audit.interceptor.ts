/**
 * ═══════════════════════════════════════════════════════════════════════════
 * Audit Interceptor - Security Event Logging
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Logs all API requests for security audit and compliance.
 *
 * Phase 0 (D-013, FIX-003): The interceptor used to only `console.log` events.
 * `AuditService.log()` (which writes to the `AuditLog` DB table) is now called
 * for every mutating request (POST/PATCH/DELETE/PUT). GET requests are
 * intentionally NOT logged (volume concern). Writes are fire-and-forget — a
 * failed audit write does not break the main request flow.
 *
 * Per `EAOS-rbac-model.md` §8:
 *   - Mutating requests: 2xx → success, 4xx/5xx → failure
 *   - Login events: handled by auth service
 *   - GET: not logged
 *
 * Follows SOLID principles - Single Responsibility for audit logging.
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, catchError, of, tap } from 'rxjs';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../../modules/audit/audit.service';
import { getRequestUser } from '../utils/request-user';

export const AUDIT_KEY = 'audit';

/**
 * Audit metadata options
 */
export interface AuditOptions {
  action: string;
  resource: string;
  includeBody?: boolean;
  includeResponse?: boolean;
}

export const Audit =
  (options: AuditOptions) =>
    (target: object, key: string, descriptor: PropertyDescriptor) => {
      Reflect.defineMetadata(AUDIT_KEY, options, descriptor.value);
      return descriptor;
    };

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) { }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse();

    const auditId = uuidv4();
    const startTime = Date.now();
    const method = request.method?.toUpperCase() ?? 'UNKNOWN';

    // Get audit metadata (per-method @Audit() decorator)
    const auditOptions = this.reflector.getAllAndOverride<AuditOptions>(
      AUDIT_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Extract user information
    const user = getRequestUser(request);
    const userId = user?.id ?? user?.sub;
    const tenantId = user?.tenantId ?? undefined;
    const actor = userId ?? 'anonymous';

    // Resolve the action label
    const action =
      auditOptions?.action ?? `api.${method} ${this.normalizePath(request.path)}`;
    const resource = auditOptions?.resource ?? 'http';
    const resourceId = this.extractResourceId(request);

    // Skip non-mutating methods (GET, HEAD, OPTIONS) — volume concern.
    const shouldAudit = MUTATING_METHODS.has(method);

    if (!shouldAudit) {
      return next.handle();
    }

    const ipAddress = this.extractIp(request);
    const userAgent = request.headers['user-agent'] as string | undefined;

    // Still log to stdout (preserves prior dev-friendly console output) AND
    // write to DB. The console line stays for ops debugging; the DB row is
    // the compliance-grade audit trail.
    this.logRequest(auditId, request, auditOptions, userId, tenantId);

    return next.handle().pipe(
      tap({
        next: (data) => {
          const duration = Date.now() - startTime;
          const statusCode = response?.statusCode ?? 0;
          this.logResponse(
            auditId,
            request,
            response,
            duration,
            auditOptions,
            data,
          );
          this.writeAudit({
            actor,
            action,
            resource,
            resourceId,
            tenantId,
            ipAddress,
            userAgent,
            result: statusCode >= 400 ? 'failure' : 'success',
            details: {
              auditId,
              statusCode,
              durationMs: Date.now() - startTime,
              method,
              path: request.path,
              ...this.buildDetails(request, auditOptions, data, undefined),
            },
          });
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logError(auditId, request, error, duration, auditOptions);
          this.writeAudit({
            actor,
            action,
            resource,
            resourceId,
            tenantId,
            ipAddress,
            userAgent,
            result: 'failure',
            details: {
              auditId,
              statusCode: error?.status ?? 500,
              durationMs: Date.now() - startTime,
              method,
              path: request.path,
              ...this.buildDetails(request, auditOptions, undefined, error),
            },
          });
        },
      }),
      // catchError re-throws any error that propagated through the handler so
      // the correct HTTP status code (401/403/400/etc.) is preserved.
      // NOTE: writeAudit() is fire-and-forget and never injects into this pipe,
      // so this catchError only fires for genuine handler errors that must reach
      // the GlobalExceptionFilter with their original type/status intact.
      catchError((err) => {
        this.logger.warn(
          `[Audit] Handler error propagated through interceptor pipe: ${String(err)}`,
        );
        throw err;
      }),
    );
  }

  /**
   * Phase 0 (D-013, FIX-003): fire-and-forget audit write. Service handles
   * its own error logging; we don't await.
   */
  private writeAudit(input: {
    actor: string;
    action: string;
    resource?: string;
    resourceId?: string;
    tenantId?: string;
    ipAddress?: string;
    userAgent?: string;
    result?: 'success' | 'failure';
    details?: Record<string, unknown>;
  }): void {
    // Void the promise so the request flow never blocks on DB write.
    void this.auditService.log(input).catch((err) => {
      this.logger.warn(
        `[Audit] DB write rejected (request NOT blocked): ${String(err)}`,
      );
    });
  }

  private buildDetails(
    request: Request,
    options: AuditOptions | undefined,
    responseData: unknown,
    error: Error | undefined,
  ): Record<string, unknown> {
    const details: Record<string, unknown> = {};
    if (options?.includeBody && MUTATING_METHODS.has(request.method ?? '')) {
      details.requestBody = this.sanitizeBody(request.body);
    }
    if (options?.includeResponse) {
      details.responseBody = this.sanitizeResponse(responseData);
    }
    if (error) {
      details.errorMessage = error.message;
      details.errorName = error.name;
    }
    return details;
  }

  private extractResourceId(request: Request): string | undefined {
    // Common param names; adjust as needed.
    const params = request.params as Record<string, string | undefined> | undefined;
    return params?.id ?? params?.entityId ?? params?.userId;
  }

  private normalizePath(path: string): string {
    // Replace UUIDs with :id to avoid cardinality explosion in the audit log.
    return path.replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id',
    );
  }

  /**
   * Log incoming request
   */
  private logRequest(
    auditId: string,
    request: Request,
    options: AuditOptions | undefined,
    userId?: string,
    tenantId?: string,
  ): void {
    const logData = {
      auditId,
      type: 'REQUEST',
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.path,
      query: request.query,
      userId,
      tenantId,
      ip: this.extractIp(request),
      userAgent: request.headers['user-agent'],
      action: options?.action,
      resource: options?.resource,
    };

    if (
      options?.includeBody &&
      ['POST', 'PUT', 'PATCH'].includes(request.method ?? '')
    ) {
      const sanitizedBody = this.sanitizeBody(request.body);
      Object.assign(logData, { body: sanitizedBody });
    }

    this.logger.log(JSON.stringify(logData));
  }

  /**
   * Log response
   */
  private logResponse(
    auditId: string,
    request: Request,
    response: any,
    duration: number,
    options: AuditOptions | undefined,
    data: unknown,
  ): void {
    const logData = {
      auditId,
      type: 'RESPONSE',
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.path,
      statusCode: response.statusCode,
      duration: `${duration}ms`,
      action: options?.action,
      resource: options?.resource,
    };

    if (options?.includeResponse) {
      Object.assign(logData, { response: this.sanitizeResponse(data) });
    }

    this.logger.log(JSON.stringify(logData));
  }

  /**
   * Log error
   */
  private logError(
    auditId: string,
    request: Request,
    error: Error,
    duration: number,
    options: AuditOptions | undefined,
  ): void {
    const logData = {
      auditId,
      type: 'ERROR',
      timestamp: new Date().toISOString(),
      method: request.method,
      path: request.path,
      statusCode: (error as { status?: number }).status ?? 500,
      duration: `${duration}ms`,
      error: error.message,
      action: options?.action,
      resource: options?.resource,
    };

    this.logger.error(JSON.stringify(logData));
  }

  /**
   * Extract client IP from request
   */
  private extractIp(request: Request): string {
    const forwardedFor = request.headers['x-forwarded-for'];
    if (forwardedFor) {
      return Array.isArray(forwardedFor)
        ? forwardedFor[0].split(',')[0].trim()
        : forwardedFor.split(',')[0].trim();
    }

    const realIp = request.headers['x-real-ip'];
    if (realIp) {
      return Array.isArray(realIp) ? realIp[0] : realIp;
    }

    return request.ip || request.socket?.remoteAddress || 'unknown';
  }

  /**
   * Sanitize request body
   */
  private sanitizeBody(body: unknown): unknown {
    if (!body || typeof body !== 'object') return body;

    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
    ];
    const sanitized = { ...body } as Record<string, unknown>;

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  /**
   * Sanitize response data
   */
  private sanitizeResponse(data: unknown): unknown {
    if (!data || typeof data !== 'object') return data;

    const sensitiveFields = ['password', 'token', 'secret', 'apiKey'];
    const sanitized = Array.isArray(data) ? [] : {};

    if (Array.isArray(data)) {
      return data.map((item) => this.sanitizeResponse(item));
    }

    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (sensitiveFields.includes(key.toLowerCase())) {
        (sanitized as Record<string, unknown>)[key] = '[REDACTED]';
      } else if (typeof value === 'object') {
        (sanitized as Record<string, unknown>)[key] =
          this.sanitizeResponse(value);
      } else {
        (sanitized as Record<string, unknown>)[key] = value;
      }
    }

    return sanitized;
  }
}
