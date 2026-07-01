/**
 * Department Templates API Route
 * GET /api/v1/dept-templates - List department templates
 * POST /api/v1/dept-templates - Create template
 */

import { NextRequest } from 'next/server';
import { successResponse, badRequest, unauthorized, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate, hasRole } from '@/lib/api/auth';
import type { DepartmentTemplate } from '@/lib/api/types';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    await authenticate(request);

    const result = await apiRequest<{ data: DepartmentTemplate[] }>('/dept-templates', {
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result);
  } catch (error) {
    console.error('Dept templates error:', error);
    return serverError('Failed to fetch department templates');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, 'ADMIN')) {
      return unauthorized('Admin access required');
    }

    const body = await request.json();
    const { name, description, category, config } = body;

    if (!name || !category) {
      return badRequest('Missing required fields: name, category');
    }

    const result = await apiRequest<DepartmentTemplate>('/dept-templates', {
      method: 'POST',
      body: { name, description, category, config },
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error('Create dept template error:', error);
    return serverError('Failed to create department template');
  }
}