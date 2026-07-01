/**
 * Connectors API Route
 * GET /api/v1/connectors - List connectors
 * POST /api/v1/connectors - Create connector
 */

import { NextRequest } from 'next/server';
import { successResponse, badRequest, unauthorized, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate, hasRole } from '@/lib/api/auth';
import type { Connector } from '@/lib/api/types';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    const { searchParams } = new URL(request.url);
    const tenantId = searchParams.get('tenantId');

    if (!tenantId && user.role !== 'SUPER_ADMIN') {
      return badRequest('tenantId is required');
    }

    const query = tenantId ? `?tenantId=${tenantId}` : '';
    const result = await apiRequest<{ data: Connector[] }>(
      `/api/v1/connectors${query}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } }
    );

    return successResponse(result);
  } catch (error) {
    console.error('List connectors error:', error);
    return serverError('Failed to fetch connectors');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, 'ADMIN')) {
      return unauthorized('Admin access required');
    }

    const body = await request.json();
    const { name, type, tenantId, config } = body;

    if (!name || !type || !tenantId) {
      return badRequest('Missing required fields: name, type, tenantId');
    }

    const result = await apiRequest<Connector>('/connectors', {
      method: 'POST',
      body: { name, type, tenantId, config },
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error('Create connector error:', error);
    return serverError('Failed to create connector');
  }
}