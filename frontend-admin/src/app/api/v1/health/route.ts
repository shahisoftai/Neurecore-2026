/**
 * Health API Route
 * GET /api/v1/health - Health check (public)
 */

import { NextRequest } from 'next/server';
import { successResponse, serverError } from '@/lib/api/response';
import { apiRequest } from '@/lib/api/database';

export async function GET(_request: NextRequest): Promise<Response> {
  try {
    // Forward to backend health check
    const result = await apiRequest<{ status: string; timestamp: string }>(
      '/health',
      { requiresAuth: false }
    );

    return successResponse(result);
  } catch {
    // Return basic health if backend unavailable
    return successResponse({
      status: 'degraded',
      timestamp: new Date().toISOString(),
    });
  }
}