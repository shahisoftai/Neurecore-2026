/**
 * Governance API Route
 * GET /api/v1/governance - List approvals
 */

import { NextRequest } from 'next/server';
import { successResponse, unauthorized, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate, hasRole } from '@/lib/api/auth';
import type { Approval } from '@/lib/api/types';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, 'ADMIN')) {
      return unauthorized('Admin access required');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const status = searchParams.get('status');

    const query = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (status) query.set('status', status);

    const result = await apiRequest<{ data: Approval[]; total: number }>(
      `/api/v1/governance?${query}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } }
    );

    return successResponse(result);
  } catch (error) {
    console.error('Governance error:', error);
    return serverError('Failed to fetch approvals');
  }
}