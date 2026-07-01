/**
 * Logging Service for NeureCore Backend
 *
 * A comprehensive logging service following SOLID principles:
 * - Single Responsibility: Handles all logging concerns
 * - Open/Closed: Can be extended with new log formats/destinations
 *
 * Features:
 * - Structured JSON logging for production
 * - Log levels (debug, info, warn, error, fatal)
 * - Context support for tracking requests
 * - Performance monitoring
 * - Error tracking with full context
 */

import {
  Injectable,
  LoggerService as NestLoggerService,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { performance } from 'perf_hooks';
import { v4 as uuidv4 } from 'uuid';
import {
  AppError,
  DetailedApiError,
  ErrorCategory,
} from '../errors/app-errors';

// ============================================
// LOG LEVELS
// ============================================

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  FATAL = 'fatal',
}

// ============================================
// LOG ENTRY INTERFACE
// ============================================

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: string;
  requestId?: string;
  correlationId?: string;
  userId?: string;
  tenantId?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string;
    category?: ErrorCategory;
    statusCode?: number;
    details?: Record<string, unknown>;
  };
}

// ============================================
// PERFORMANCE MARKER
// ============================================

export interface PerformanceMarker {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, unknown>;
}

// ============================================
// LOGGING SERVICE IMPLEMENTATION
// ============================================

@Injectable()
export class LoggingService implements NestLoggerService {
  private readonly context: string;
  private readonly isProduction: boolean;
  private readonly logLevel: LogLevel;
  private readonly performanceMarkers: Map<string, PerformanceMarker> =
    new Map();
  private readonly maxLogLevelPriority: number;

  // Log level priorities for filtering
  private static readonly LOG_LEVEL_PRIORITIES: Record<LogLevel, number> = {
    [LogLevel.DEBUG]: 0,
    [LogLevel.INFO]: 1,
    [LogLevel.WARN]: 2,
    [LogLevel.ERROR]: 3,
    [LogLevel.FATAL]: 4,
  };

  constructor(
    @Optional() context: string = 'App',
    private readonly configService?: ConfigService,
  ) {
    this.context = context;
    this.isProduction = this.configService?.get('NODE_ENV') === 'production';
    this.logLevel =
      (this.configService?.get('LOG_LEVEL') as LogLevel) ?? LogLevel.INFO;
    this.maxLogLevelPriority =
      LoggingService.LOG_LEVEL_PRIORITIES[this.logLevel];
  }

  /**
   * Generate a new correlation ID for request tracking
   */
  generateCorrelationId(): string {
    return uuidv4();
  }

  /**
   * Check if a log level should be logged based on configuration
   */
  private shouldLog(level: LogLevel): boolean {
    return (
      LoggingService.LOG_LEVEL_PRIORITIES[level] >= this.maxLogLevelPriority
    );
  }

  /**
   * Format log entry for output
   */
  private formatLogEntry(
    level: LogLevel,
    message: string,
    context?: string,
    meta?: Record<string, unknown>,
  ): string {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: context ?? this.context,
      ...meta,
    };

    // In production, output as JSON for log aggregation
    if (this.isProduction) {
      return JSON.stringify(entry);
    }

    // In development, use a human-readable format
    const timestamp = entry.timestamp.split('T')[1].replace('Z', '');
    const metaString = entry.metadata
      ? ` ${JSON.stringify(entry.metadata)}`
      : '';
    const errorString = entry.error
      ? `\n  Error: ${entry.error.name}: ${entry.error.message}\n  Stack: ${entry.error.stack}`
      : '';

    return `[${timestamp}] ${level.toUpperCase().padEnd(5)} [${entry.context}] ${message}${metaString}${errorString}`;
  }

  /**
   * Log to console
   */
  private logToConsole(
    level: LogLevel,
    message: string,
    formattedEntry: string,
  ): void {
    const consoleMethod =
      level === LogLevel.ERROR || level === LogLevel.FATAL
        ? console.error
        : level === LogLevel.WARN
          ? console.warn
          : console.log;

    consoleMethod(formattedEntry);
  }

  // ============================================
  // PUBLIC LOGGING METHODS
  // ============================================

  /**
   * Log a debug message
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const formatted = this.formatLogEntry(
      LogLevel.DEBUG,
      message,
      this.context,
      meta,
    );
    this.logToConsole(LogLevel.DEBUG, message, formatted);
  }

  /**
   * Log an info message
   */
  log(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const formatted = this.formatLogEntry(
      LogLevel.INFO,
      message,
      this.context,
      meta,
    );
    this.logToConsole(LogLevel.INFO, message, formatted);
  }

  /**
   * Log a warning
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const formatted = this.formatLogEntry(
      LogLevel.WARN,
      message,
      this.context,
      meta,
    );
    this.logToConsole(LogLevel.WARN, message, formatted);
  }

  /**
   * Log an error
   */
  error(message: string, trace?: string, meta?: Record<string, unknown>): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const errorMeta = trace ? { ...meta, stack: trace } : meta;

    const formatted = this.formatLogEntry(
      LogLevel.ERROR,
      message,
      this.context,
      errorMeta,
    );
    this.logToConsole(LogLevel.ERROR, message, formatted);
  }

  /**
   * Log a fatal error
   */
  fatal(message: string, meta?: Record<string, unknown>): void {
    const formatted = this.formatLogEntry(
      LogLevel.FATAL,
      message,
      this.context,
      meta,
    );
    this.logToConsole(LogLevel.FATAL, message, formatted);
  }

  // ============================================
  // CONTEXTUAL LOGGING
  // ============================================

  /**
   * Create a child logger with additional context
   */
  createChildLogger(context: string): LoggingService {
    return new LoggingService(context, this.configService);
  }

  /**
   * Log with request context
   */
  logWithRequest(
    message: string,
    level: LogLevel,
    options: {
      requestId?: string;
      correlationId?: string;
      userId?: string;
      tenantId?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const meta = {
      requestId: options.requestId,
      correlationId: options.correlationId,
      userId: options.userId,
      tenantId: options.tenantId,
      ...options.metadata,
    };

    switch (level) {
      case LogLevel.DEBUG:
        this.debug(message, meta);
        break;
      case LogLevel.INFO:
        this.log(message, meta);
        break;
      case LogLevel.WARN:
        this.warn(message, meta);
        break;
      case LogLevel.ERROR:
        this.error(message, undefined, meta);
        break;
      case LogLevel.FATAL:
        this.fatal(message, meta);
        break;
    }
  }

  // ============================================
  // ERROR LOGGING
  // ============================================

  /**
   * Log an error with full context
   */
  logError(
    error: Error | DetailedApiError,
    context?: {
      requestId?: string;
      correlationId?: string;
      userId?: string;
      tenantId?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const standardError = error as Error;
    const isDetailedError =
      'code' in error && 'category' in error && 'statusCode' in error;

    const errorMeta = isDetailedError
      ? {
          error: {
            name: standardError.name || 'Error',
            message: error.message,
            code: error.code,
            category: error.category,
            statusCode: error.statusCode,
            details: error.details,
            stack: standardError.stack,
          },
          ...context?.metadata,
        }
      : {
          error: {
            name: standardError.name || 'Error',
            message: error.message,
            stack: standardError.stack,
          },
          ...context?.metadata,
        };

    const level =
      isDetailedError && error.category === ErrorCategory.INTERNAL
        ? LogLevel.FATAL
        : LogLevel.ERROR;

    this.logWithRequest(error.message, level, {
      requestId: context?.requestId,
      correlationId: context?.correlationId,
      userId: context?.userId,
      tenantId: context?.tenantId,
      metadata: errorMeta,
    });
  }

  /**
   * Log an unhandled exception
   */
  logUnhandledException(
    error: Error,
    context?: {
      requestId?: string;
      correlationId?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    this.fatal('Unhandled exception', {
      ...context?.metadata,
      requestId: context?.requestId,
      correlationId: context?.correlationId,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  // ============================================
  // PERFORMANCE MONITORING
  // ============================================

  /**
   * Start a performance timer
   */
  startPerformanceTimer(
    name: string,
    metadata?: Record<string, unknown>,
  ): void {
    this.performanceMarkers.set(name, {
      name,
      startTime: performance.now(),
      metadata,
    });
  }

  /**
   * End a performance timer and log the result
   */
  endPerformanceTimer(
    name: string,
    options?: {
      correlationId?: string;
      requestId?: string;
      threshold?: number; // Log warning if duration exceeds this (ms)
    },
  ): number | undefined {
    const marker = this.performanceMarkers.get(name);
    if (!marker) {
      this.warn(`Performance timer '${name}' was not started`);
      return undefined;
    }

    const endTime = performance.now();
    const duration = Math.round(endTime - marker.startTime);
    marker.endTime = endTime;
    marker.duration = duration;

    const meta = {
      duration,
      ...marker.metadata,
      requestId: options?.requestId,
      correlationId: options?.correlationId,
    };

    // Log warning if duration exceeds threshold
    if (options?.threshold && duration > options.threshold) {
      this.warn(
        `Performance threshold exceeded for '${name}': ${duration}ms > ${options.threshold}ms`,
        meta,
      );
    } else {
      this.debug(`Performance: ${name} completed in ${duration}ms`, meta);
    }

    this.performanceMarkers.delete(name);
    return duration;
  }

  /**
   * Measure async function execution time
   */
  async measureAsync<T>(
    name: string,
    fn: () => Promise<T>,
    options?: {
      correlationId?: string;
      requestId?: string;
      threshold?: number;
    },
  ): Promise<T> {
    this.startPerformanceTimer(name, {
      correlationId: options?.correlationId,
      requestId: options?.requestId,
    });
    try {
      const result = await fn();
      this.endPerformanceTimer(name, options);
      return result;
    } catch (error) {
      this.endPerformanceTimer(name, options);
      throw error;
    }
  }

  /**
   * Measure sync function execution time
   */
  measureSync<T>(
    name: string,
    fn: () => T,
    options?: {
      correlationId?: string;
      requestId?: string;
      threshold?: number;
    },
  ): T {
    this.startPerformanceTimer(name, {
      correlationId: options?.correlationId,
      requestId: options?.requestId,
    });
    try {
      const result = fn();
      this.endPerformanceTimer(name, options);
      return result;
    } catch (error) {
      this.endPerformanceTimer(name, options);
      throw error;
    }
  }

  // ============================================
  // REQUEST/RESPONSE LOGGING
  // ============================================

  /**
   * Log incoming HTTP request
   */
  logRequest(
    request: {
      method: string;
      url: string;
      headers?: Record<string, unknown>;
      body?: unknown;
      query?: Record<string, unknown>;
      params?: Record<string, string>;
    },
    correlationId?: string,
  ): void {
    const meta = {
      type: 'request',
      method: request.method,
      url: request.url,
      query: request.query,
      params: request.params,
      correlationId,
    };

    // Don't log sensitive data
    const safeBody = this.sanitizeBody(request.body);
    if (safeBody) {
      Object.assign(meta, { body: safeBody });
    }

    this.log(`${request.method} ${request.url}`, meta);
  }

  /**
   * Log HTTP response
   */
  logResponse(
    request: { method: string; url: string },
    response: { statusCode: number; headers?: Record<string, unknown> },
    duration: number,
    correlationId?: string,
  ): void {
    const level =
      response.statusCode >= 500
        ? LogLevel.ERROR
        : response.statusCode >= 400
          ? LogLevel.WARN
          : LogLevel.INFO;

    this.logWithRequest(
      `${request.method} ${request.url} ${response.statusCode} ${duration}ms`,
      level,
      {
        correlationId,
        metadata: {
          type: 'response',
          statusCode: response.statusCode,
          duration,
        },
      },
    );
  }

  /**
   * Sanitize sensitive data from request body
   */
  private sanitizeBody(body: unknown): Record<string, unknown> | undefined {
    if (!body || typeof body !== 'object') {
      return undefined;
    }

    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'apiKey',
      'creditCard',
      'ssn',
    ];
    const sanitized = { ...(body as Record<string, unknown>) };

    for (const key of Object.keys(sanitized)) {
      if (sensitiveKeys.some((sk) => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// ============================================
// LOGGING MODULE
// ============================================

export const LOGGING_SERVICE = 'LOGGING_SERVICE';

/**
 * Factory function to create LoggingService
 */
export function createLoggingService(context?: string): LoggingService {
  return new LoggingService(context);
}
