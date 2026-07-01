/**
 * Tenants API Route
 * GET /api/v1/tenants - List tenants
 * POST /api/v1/tenants - Create tenant
 */

import { NextRequest } from 'next/server';
import { successResponse, badRequest, unauthorized, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate, hasRole } from '@/lib/api/auth';
import type { Tenant, CreateTenantInput } from '@/lib/api/types';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, 'SUPER_ADMIN')) {
      return unauthorized('Super admin access required');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');

    const result = await apiRequest<{ data: Tenant[]; total: number }>(
      `/api/v1/tenants?page=${page}&limit=${limit}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } }
    );

    return successResponse(result);
  } catch (error) {
    console.error('List tenants error:', error);
    return serverError('Failed to fetch tenants');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, 'SUPER_ADMIN')) {
      return unauthorized('Super admin access required');
    }

    const body = await request.json();
    const { name, slug, plan } = body;

    if (!name || !slug) {
      return badRequest('Missing required fields: name, slug');
    }

    const input: CreateTenantInput = { name, slug, plan };

    const result = await apiRequest<Tenant>('/tenants', {
      method: 'POST',
      body: input,
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error('Create tenant error:', error);
    return serverError('Failed to create tenant');
  }
}