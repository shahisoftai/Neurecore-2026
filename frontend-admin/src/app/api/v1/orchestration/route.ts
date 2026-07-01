/**
 * Orchestration API Route
 * GET /api/v1/orchestration - Get tasks and workflows
 */

import { NextRequest } from 'next/server';
import { successResponse, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate } from '@/lib/api/auth';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await authenticate(request);

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'tasks'; // tasks | workflows

    const result = await apiRequest<{ data: unknown[] }>(`/api/v1/orchestration/${type}`, {
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result);
  } catch (error) {
    console.error('Orchestration error:', error);
    return serverError('Failed to fetch orchestration data');
  }
}