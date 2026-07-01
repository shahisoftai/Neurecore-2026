/**
 * Agent Templates API Route
 * GET /api/v1/agent-templates - List templates
 * POST /api/v1/agent-templates - Create template
 */

import { NextRequest } from 'next/server';
import { successResponse, badRequest, unauthorized, serverError } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate, hasRole } from '@/lib/api/auth';
import type { AgentTemplate } from '@/lib/api/types';

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category');

    const query = new URLSearchParams({ page: page.toString(), limit: limit.toString() });
    if (category) query.set('category', category);

    const result = await apiRequest<{ data: AgentTemplate[]; total: number }>(
      `/api/v1/agent-templates?${query}`,
      { headers: { Authorization: `Bearer ${await getAuthToken(request)}` } }
    );

    return successResponse(result);
  } catch (error) {
    console.error('List agent templates error:', error);
    return serverError('Failed to fetch agent templates');
  }
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const user = await authenticate(request);
    if (!hasRole(user, 'ADMIN')) {
      return unauthorized('Admin access required');
    }

    const body = await request.json();
    const { name, description, category, version, config } = body;

    if (!name || !category) {
      return badRequest('Missing required fields: name, category');
    }

    const result = await apiRequest<AgentTemplate>('/agent-templates', {
      method: 'POST',
      body: { name, description, category, version, config },
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error('Create agent template error:', error);
    return serverError('Failed to create agent template');
  }
}