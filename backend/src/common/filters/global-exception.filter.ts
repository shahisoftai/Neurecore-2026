/**
 * Global Exception Filter for NeureCore Backend
 *
 * A comprehensive exception filter following SOLID principles:
 * - Single Responsibility: Handles all unhandled exceptions
 * - Open/Closed: Easy to extend with new error types
 *
 * Features:
 * - Proper HTTP status code mapping
 * - Detailed error logging
 * - User-friendly error messages
 * - Correlation ID tracking
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Inject,
  Optional,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  AppError,
  ErrorCode,
  ErrorCodeType,
  ErrorCategory,
} from '../errors/app-errors';
import { LoggingService, LogLevel } from '../logging';

// ============================================
// ERROR RESPONSE TYPES
// ============================================

interface ApiErrorResponse {
  status: 'error';
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta: {
    timestamp: string;
    requestId: string;
  };
}

// ============================================
// GLOBAL EXCEPTION FILTER
// ============================================

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger;

  // Maps HTTP status to error codes
  private static readonly STATUS_TO_ERROR_CODE: Record<number, ErrorCodeType> =
    {
      [HttpStatus.BAD_REQUEST]: ErrorCode.INVALID_REQUEST,
      [HttpStatus.UNAUTHORIZED]: ErrorCode.AUTHENTICATION_FAILED,
      [HttpStatus.FORBIDDEN]: ErrorCode.PERMISSION_DENIED,
      [HttpStatus.NOT_FOUND]: ErrorCode.NOT_FOUND,
      [HttpStatus.CONFLICT]: ErrorCode.CONFLICT,
      [HttpStatus.UNPROCESSABLE_ENTITY]: ErrorCode.VALIDATION_ERROR,
      [HttpStatus.TOO_MANY_REQUESTS]: ErrorCode.RATE_LIMIT_EXCEEDED,
      [HttpStatus.SERVICE_UNAVAILABLE]: ErrorCode.SERVICE_UNAVAILABLE,
    };

  constructor(
    @Optional() @Inject(LoggingService) private loggingService?: LoggingService,
  ) {
    this.logger = new Logger(GlobalExceptionFilter.name);
  }

  /**
   * Catch and handle any unhandled exception
   */
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Generate request ID for tracking
    const requestId = (request.headers['x-request-id'] as string) || uuidv4();

    // Determine the error and response
    const { status, code, message, details, isOperational } =
      this.determineError(exception, requestId);

    // Log the error with full context
    this.logError(exception, {
      requestId,
      method: request.method,
      url: request.url,
      status,
      isOperational,
    });

    // Build the error response
    const errorResponse: ApiErrorResponse = {
      status: 'error',
      error: {
        code,
        message: this.getUserFriendlyMessage(code, message),
        details: this.isProduction() ? undefined : details,
      },
      meta: {
        timestamp: new Date().toISOString(),
        requestId,
      },
    };

    // Send the response
    response.status(status).json(errorResponse);
  }

  /**
   * Determine the error type and extract relevant information
   */
  private determineError(
    exception: unknown,
    requestId: string,
  ): {
    status: number;
    code: ErrorCodeType;
    message: string;
    details?: Record<string, unknown>;
    isOperational: boolean;
  } {
    // Handle our custom AppError
    if (exception instanceof AppError) {
      return {
        status: exception.statusCode,
        code: exception.code,
        message: exception.message,
        details: exception.details,
        isOperational: exception.isOperational,
      };
    }

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      const httpStatus = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      let message: string;
      let details: Record<string, unknown> | undefined;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const res = exceptionResponse as Record<string, unknown>;
        message = Array.isArray(res.message)
          ? 'Validation failed'
          : ((res.message as string) ?? exception.message);

        // Handle validation errors
        if (Array.isArray(res.message)) {
          details = { errors: res.message };
        }
      } else {
        message =
          typeof exceptionResponse === 'string'
            ? exceptionResponse
            : exception.message;
      }

      return {
        status: httpStatus,
        code:
          GlobalExceptionFilter.STATUS_TO_ERROR_CODE[httpStatus] ||
          ErrorCode.INTERNAL_ERROR,
        message,
        details,
        isOperational: true,
      };
    }

    // Handle standard JavaScript errors
    if (exception instanceof Error) {
      this.logger.error(
        `Unhandled error: ${exception.message}`,
        exception.stack,
      );

      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: ErrorCode.INTERNAL_ERROR,
        message: this.isProduction()
          ? 'An unexpected error occurred'
          : exception.message,
        details: this.isProduction() ? undefined : { stack: exception.stack },
        isOperational: false,
      };
    }

    // Handle unknown errors
    this.logger.error(`Unknown exception: ${String(exception)}`, undefined);

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: ErrorCode.INTERNAL_ERROR,
      message: 'An unexpected error occurred',
      isOperational: false,
    };
  }

  /**
   * Log the error with full context
   */
  private logError(
    exception: unknown,
    context: {
      requestId: string;
      method: string;
      url: string;
      status: number;
      isOperational: boolean;
    },
  ): void {
    // Use our custom logging service if available
    if (this.loggingService) {
      if (exception instanceof AppError) {
        this.loggingService.logError(exception, {
          correlationId: context.requestId,
          metadata: {
            method: context.method,
            url: context.url,
            httpStatus: context.status,
          },
        });
      } else if (exception instanceof Error) {
        this.loggingService.logError(exception, {
          correlationId: context.requestId,
          metadata: {
            method: context.method,
            url: context.url,
            httpStatus: context.status,
            isOperational: context.isOperational,
          },
        });
      }
    } else {
      // Fall back to NestJS logger
      const level = context.status >= 500 ? 'error' : 'warn';
      this.logger[level](
        `[${context.requestId}] ${context.method} ${context.url} - ${context.status}`,
      );
    }
  }

  /**
   * Get user-friendly message for the error code
   */
  private getUserFriendlyMessage(
    code: ErrorCodeType,
    originalMessage: string,
    exception?: unknown,
  ): string {
    // Surface validation error details to clients (user-input related, not sensitive)
    if (code === ErrorCode.INVALID_REQUEST) {
      const message = this.extractValidationMessage(exception);
      if (message) return message;
    }

    // If not in production, include original message for debugging
    if (!this.isProduction()) {
      return originalMessage;
    }

    // User-friendly messages for common errors
    const userFriendlyMessages: Partial<Record<ErrorCodeType, string>> = {
      [ErrorCode.AUTHENTICATION_FAILED]:
        'Invalid credentials. Please check your email and password.',
      [ErrorCode.TOKEN_EXPIRED]:
        'Your session has expired. Please log in again.',
      [ErrorCode.TOKEN_INVALID]: 'Session invalid. Please log in again.',
      [ErrorCode.REFRESH_TOKEN_EXPIRED]:
        'Your session has expired. Please log in again.',
      [ErrorCode.CREDENTIALS_INVALID]: 'Invalid email or password.',
      [ErrorCode.ACCOUNT_LOCKED]:
        'Your account has been locked. Please contact support.',
      [ErrorCode.ACCOUNT_DISABLED]:
        'Your account has been disabled. Please contact support.',
      [ErrorCode.PERMISSION_DENIED]:
        "You don't have permission to perform this action.",
      [ErrorCode.FORBIDDEN]: 'Access denied.',
      [ErrorCode.NOT_FOUND]: 'The requested resource was not found.',
      [ErrorCode.RESOURCE_NOT_FOUND]: 'The requested resource was not found.',
      [ErrorCode.DUPLICATE_ENTRY]: 'This item already exists.',
      [ErrorCode.RESOURCE_ALREADY_EXISTS]: 'This resource already exists.',
      [ErrorCode.RATE_LIMIT_EXCEEDED]:
        'Too many requests. Please try again later.',
      [ErrorCode.INSUFFICIENT_BALANCE]:
        'Insufficient balance for this operation.',
      [ErrorCode.PLAN_LIMIT_REACHED]: 'You have reached your plan limit.',
      [ErrorCode.INTERNAL_ERROR]:
        'Something went wrong. Please try again later.',
      [ErrorCode.SERVICE_UNAVAILABLE]:
        'Service temporarily unavailable. Please try again later.',
    };

    return (
      userFriendlyMessages[code] ||
      'An unexpected error occurred. Please try again.'
    );
  }

  /**
   * Check if running in production
   */
  private isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  /**
   * Extract the validation message array from a class-validator HttpException.
   * Returns the joined string when the exception carries a message array
   * (the canonical class-validator shape), otherwise returns null.
   *
   * Replaces the previous `(exception as any)?.response?.message` cast.
   */
  private extractValidationMessage(exception: unknown): string | null {
    if (!exception || typeof exception !== 'object') return null;
    const response = (exception as { response?: unknown }).response;
    if (!response || typeof response !== 'object') return null;
    const message = (response as { message?: unknown }).message;
    if (!Array.isArray(message)) return null;
    return message.join('; ');
  }
}
