/**
 * Users API Route
 * GET /api/v1/users - List users
 * POST /api/v1/users - Create user
 * 
 * Following Single Responsibility - handles user CRUD operations
 */

import { NextRequest } from 'next/server';
import { 
  successResponse, 
  badRequest, 
  unauthorized, 
  notFound,
  serverError 
} from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import { authenticate, hasRole } from '@/lib/api/auth';
import type { User, CreateUserInput } from '@/lib/api/types';

/**
 * Handle GET request - list users
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    // Authenticate request
    const user = await authenticate(request);
    
    // Check permissions (admin only)
    if (!hasRole(user, 'ADMIN')) {
      return unauthorized('Admin access required');
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const tenantId = searchParams.get('tenantId');

    // Build query string
    const query = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    });
    if (tenantId) query.set('tenantId', tenantId);

    // Call backend API
    const result = await apiRequest<{ data: User[]; total: number }>(
      `/api/v1/users?${query}`,
      {
        headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
      }
    );

    return successResponse(result);
  } catch (error) {
    console.error('List users error:', error);
    return serverError('Failed to fetch users');
  }
}

/**
 * Handle POST request - create user
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Authenticate request
    const user = await authenticate(request);
    
    // Check permissions (admin only)
    if (!hasRole(user, 'ADMIN')) {
      return unauthorized('Admin access required');
    }

    // Parse and validate request body
    const body = await request.json();
    const { email, password, firstName, lastName, role, tenantId } = body;

    // Validate required fields
    if (!email || !password || !firstName || !lastName) {
      return badRequest('Missing required fields');
    }

    // Prepare create input
    const createInput: CreateUserInput = {
      email,
      password,
      firstName,
      lastName,
      role,
      tenantId,
    };

    // Call backend API
    const result = await apiRequest<User>('/users', {
      method: 'POST',
      body: createInput,
      headers: { Authorization: `Bearer ${await getAuthToken(request)}` },
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error('Create user error:', error);
    
    if (error instanceof Error && error.message.includes('already exists')) {
      return badRequest('User already exists');
    }
    
    return serverError('Failed to create user');
  }
}