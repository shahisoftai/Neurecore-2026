/**
 * Auth API Route - Refresh Token
 * POST /api/v1/auth/refresh
 * 
 * Following Single Responsibility - handles token refresh
 */

import { NextRequest } from 'next/server';
import { successResponse, badRequest, unauthorized, serverError } from '@/lib/api/response';
import { apiRequest } from '@/lib/api/database';
import type { RefreshTokenInput, TokenPair } from '@/lib/api/types';

/**
 * Handle POST request for token refresh
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Parse and validate request body
    const body = await request.json();
    
    if (!body.refreshToken) {
      return badRequest('Missing required field: refreshToken');
    }

    // Call backend API
    const result = await apiRequest<TokenPair>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: body.refreshToken } as RefreshTokenInput,
      requiresAuth: false,
    });

    // Set new auth token cookie
    const response = successResponse(result);
    
    response.cookies.set('auth-token', result.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: result.expiresIn,
      path: '/',
    });

    // Update refresh token
    response.cookies.set('refresh-token', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30,
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Token refresh error:', error);
    return unauthorized('Invalid or expired refresh token');
  }
}