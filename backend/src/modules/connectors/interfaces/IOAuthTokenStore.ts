/**
 * IOAuthTokenStore — Phase 4.3
 * ISP: narrow contract for OAuth token CRUD only.
 * Implementations: PrismaOAuthTokenStore (production), MemoryOAuthTokenStore (tests).
 */
export interface OAuthTokenData {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface IOAuthTokenStore {
  save(tenantId: string, provider: string, data: OAuthTokenData): Promise<void>;
  get(tenantId: string, provider: string): Promise<OAuthTokenData | null>;
  delete(tenantId: string, provider: string): Promise<void>;
  isExpired(tenantId: string, provider: string): Promise<boolean>;
}
