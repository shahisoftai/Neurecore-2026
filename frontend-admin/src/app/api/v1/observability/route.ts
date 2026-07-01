/**
 * Observability API Route
 * GET /api/v1/observability - Get system metrics
 */

import { NextRequest } from 'next/server';
import { successResponse, unauthorized, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate, hasRole } from '@/lib/api/auth';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, 'ADMIN')) {
      return unauthorized('Admin access required');
    }

    const result = await apiRequest<{ data: unknown }>('/observability', {
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result);
  } catch (error) {
    console.error('Observability error:', error);
    return serverError('Failed to fetch observability data');
  }
}