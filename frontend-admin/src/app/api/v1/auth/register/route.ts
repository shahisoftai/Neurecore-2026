/**
 * Auth API Route - Register
 * POST /api/v1/auth/register
 * 
 * Following Single Responsibility - handles user registration
 * Following Interface Segregation - minimal request/response contracts
 */

import { NextRequest } from 'next/server';
import { successResponse, badRequest, conflict, serverError } from '@/lib/api/response';
import { apiRequest } from '@/lib/api/database';
import type { RegisterInput, AuthResult } from '@/lib/api/types';

/**
 * Handle POST request for user registration
 */
export async function POST(request: NextRequest): Promise<Response> {
  try {
    // Parse and validate request body
    const body = await request.json();
    
    // Validate required fields
    const { email, password, firstName, lastName } = body;
    
    if (!email || !password || !firstName || !lastName) {
      return badRequest('Missing required fields: email, password, firstName, lastName');
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return badRequest('Invalid email format');
    }

    // Validate password strength
    if (password.length < 8) {
      return badRequest('Password must be at least 8 characters');
    }

    // Prepare registration input
    const registerInput: RegisterInput = {
      email,
      password,
      firstName,
      lastName,
      role: body.role,
      tenantId: body.tenantId,
    };

    // Call backend API (or use embedded logic after migration)
    const result = await apiRequest<AuthResult>('/auth/register', {
      method: 'POST',
      body: registerInput,
      requiresAuth: false,
    });

    return successResponse(result, 201);
  } catch (error) {
    console.error('Registration error:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('already registered')) {
        return conflict('Email already registered');
      }
      if (error.message.includes('Tenant not found')) {
        return badRequest('Tenant not found', { tenantId: 'Invalid tenant' });
      }
      if (error.message.includes('Tenant is not active')) {
        return badRequest('Tenant is not active', { tenantStatus: 'Check tenant status' });
      }
    }
    
    return serverError('Registration failed');
  }
}