/**
 * Auth API Route - Current User / Logout
 * GET /api/v1/auth/me - Get current user
 * POST /api/v1/auth/logout - Logout user
 * 
 * Following Single Responsibility - handles user profile and logout
 */

import { NextRequest } from 'next/server';
import { successResponse, unauthorized, serverError, noContent } from '@/lib/api/response';
import { apiRequest, getAuthToken } from '@/lib/api/database';
import type { ValidatedUser } from '@/lib/api/types';

/**
 * Handle GET request - get current user
 */
export async function GET(request: NextRequest): Promise<Response> {
  try {
    const token = await getAuthToken(request);
    
    if (!token) {
      return unauthorized('No authentication token');
    }

    // Call backend API to get current user
    const user = await apiRequest<ValidatedUser>('/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    });

    return successResponse(user);
  } catch (error) {
    console.error('Get user error:', error);
    return unauthorized('Invalid or expired token');
  }
}

/**
 * Handle POST request - logout user
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    const token = await getAuthToken(request);
    
    if (token) {
      // Call backend API to invalidate token
      await apiRequest('/auth/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
    }

    // Clear auth cookies
    const response = noContent();
    response.cookies.delete('auth-token');
    response.cookies.delete('refresh-token');

    return response;
  } catch (error) {
    console.error('Logout error:', error);
    // Still clear cookies even if API call fails
    const response = noContent();
    response.cookies.delete('auth-token');
    response.cookies.delete('refresh-token');
    return response;
  }
}