/**
 * Memory API Route
 * GET /api/v1/memory - Get memory/knowledge data
 */

import { NextRequest } from 'next/server';
import { successResponse, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate } from '@/lib/api/auth';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await authenticate(request);

    const result = await apiRequest<{ data: unknown }>('/memory', {
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result);
  } catch (error) {
    console.error('Memory error:', error);
    return serverError('Failed to fetch memory data');
  }
}