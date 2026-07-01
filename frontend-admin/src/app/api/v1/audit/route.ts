/**
 * Audit API Route
 * GET /api/v1/audit - List audit logs
 */

import { NextRequest } from 'next/server';
import { successResponse, unauthorized, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate, hasRole } from '@/lib/api/auth';
import type { AuditLog } from '@/lib/api/types';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, 'ADMIN')) {
      return unauthorized('Admin access required');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const userId = searchParams.get('userId');
    const action = searchParams.get('action');

    const query = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (userId) query.set('userId', userId);
    if (action) query.set('action', action);

    const result = await apiRequest<{ data: AuditLog[]; total: number }>(
      `/api/v1/audit?${query}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } }
    );

    return successResponse(result);
  } catch (error) {
    console.error('Audit logs error:', error);
    return serverError('Failed to fetch audit logs');
  }
}