// Mirrored types — never import from backend
export type UserRole = 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'SECURITY_OFFICER' | 'SUPPORT' | 'OWNER' | 'ADMIN' | 'USER' | 'AUDITOR';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string | null;
  isActive: boolean;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResult {
  user: AuthUser;
  tokens: TokenPair;
}
