/**
 * Authentication Utilities
 * Single Responsibility: Handle JWT token verification and user validation
 * Dependency Inversion: Uses environment variables for configuration
 */

import { NextRequest } from 'next/server';
import { jwtVerify, decodeJwt } from 'jose';
import type { ValidatedUser } from './types';
import { unauthorized } from './response';

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}
if (!JWT_REFRESH_SECRET) {
  throw new Error('JWT_REFRESH_SECRET environment variable is required');
}

/**
 * Interface for JWT Payload
 */
export interface JwtPayload {
  sub: string;      // userId
  email: string;
  role: string;
  tenantId: string | null;
  jti: string;      // token ID for blacklisting
  iat?: number;
  exp?: number;
}

/**
 * Verify access token from Authorization header
 * Single Responsibility: Extract and verify JWT
 */
export async function verifyToken(request: NextRequest): Promise<JwtPayload | null> {
  const authHeader = request.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);

  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(JWT_SECRET));
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Extract token from request
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

/**
 * Decode token without verification (for refresh token)
 */
export function decodeToken(token: string): JwtPayload | null {
  try {
    const { payload } = decodeJwt(token);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Authenticate request - returns user or sends 401
 * Following Interface Segregation - minimal contract
 */
export async function authenticate(request: NextRequest): Promise<ValidatedUser> {
  const payload = await verifyToken(request);
  
  if (!payload) {
    throw unauthorized('Invalid or expired token');
  }

  return {
    id: payload.sub,
    email: payload.email,
    firstName: '',  // These would be fetched from database in production
    lastName: '',
    role: payload.role as any,
    tenantId: payload.tenantId,
    isActive: true,
  };
}

/**
 * Check if user has required role
 */
export function hasRole(user: ValidatedUser, requiredRole: string): boolean {
  const roleHierarchy: Record<string, number> = {
    USER: 1,
    ADMIN: 2,
    SUPER_ADMIN: 3,
  };

  const userLevel = roleHierarchy[user.role] || 0;
  const requiredLevel = roleHierarchy[requiredRole] || 0;

  return userLevel >= requiredLevel;
}

/**
 * Check if user belongs to tenant
 */
export function belongsToTenant(user: ValidatedUser, tenantId: string): boolean {
  return user.tenantId === tenantId || user.role === 'SUPER_ADMIN';
}

/**
 * Get request metadata (IP, User Agent)
 */
export function getRequestMeta(request: NextRequest) {
  return {
    ipAddress: request.headers.get('x-forwarded-for') || 
               request.headers.get('x-real-ip') || 
               'unknown',
    userAgent: request.headers.get('user-agent') || 'unknown',
  };
}

export { JWT_SECRET, JWT_REFRESH_SECRET };