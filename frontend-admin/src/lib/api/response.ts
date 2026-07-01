/**
 * API Response Utilities
 * Single Responsibility: Handle standardized API responses
 * Following Interface Segregation - minimal response contracts
 */

import { NextResponse } from 'next/server';
import type { ApiResponse, ApiError } from './types';

/**
 * Success Response Factory
 * Single Responsibility: Create successful JSON responses
 */
export function successResponse<T>(
  data: T,
  status: number = 200
): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  );
}

/**
 * Error Response Factory
 * Single Responsibility: Create error JSON responses
 */
export function errorResponse(
  message: string,
  status: number = 500,
  code?: string,
  details?: Record<string, unknown>
): NextResponse<ApiError> {
  return NextResponse.json(
    {
      message,
      code,
      details,
    },
    { status }
  );
}

/**
 * Not Found Response
 */
export function notFound(message: string = 'Resource not found'): NextResponse<ApiError> {
  return errorResponse(message, 404, 'NOT_FOUND');
}

/**
 * Bad Request Response
 */
export function badRequest(
  message: string = 'Invalid request',
  details?: Record<string, unknown>
): NextResponse<ApiError> {
  return errorResponse(message, 400, 'BAD_REQUEST', details);
}

/**
 * Unauthorized Response
 */
export function unauthorized(message: string = 'Unauthorized'): NextResponse<ApiError> {
  return errorResponse(message, 401, 'UNAUTHORIZED');
}

/**
 * Forbidden Response
 */
export function forbidden(message: string = 'Forbidden'): NextResponse<ApiError> {
  return errorResponse(message, 403, 'FORBIDDEN');
}

/**
 * Internal Server Error Response
 */
export function serverError(
  message: string = 'Internal server error'
): NextResponse<ApiError> {
  return errorResponse(message, 500, 'INTERNAL_ERROR');
}

/**
 * Conflict Response
 */
export function conflict(message: string): NextResponse<ApiError> {
  return errorResponse(message, 409, 'CONFLICT');
}

/**
 * No Content Response
 */
export function noContent(): NextResponse<void> {
  return new NextResponse(null, { status: 204 });
}

/**
 * Paginated Response Factory
 */
export function paginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number
): NextResponse {
  const response = NextResponse.json({
    success: true,
    data,
  });
  response.headers.set('X-Total-Count', total.toString());
  response.headers.set('X-Page', page.toString());
  response.headers.set('X-Limit', limit.toString());
  return response;
}