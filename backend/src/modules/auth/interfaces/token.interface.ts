import { UserRole } from '@prisma/client';

// Interface Segregation: minimal contract, not tied to Prisma entity
export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: UserRole;
  tenantId: string | null;
  jti: string; // token ID for blacklisting
  iat?: number;
  exp?: number;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds until access token expires
}
