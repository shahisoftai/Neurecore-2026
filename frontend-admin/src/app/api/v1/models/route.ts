/**
 * Models API Route
 * GET /api/v1/models - List available models
 */

import { NextRequest } from 'next/server';
import { successResponse, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate } from '@/lib/api/auth';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await authenticate(request);

    const result = await apiRequest<{ data: unknown[] }>('/models', {
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result);
  } catch (error) {
    console.error('Models error:', error);
    return serverError('Failed to fetch models');
  }
}