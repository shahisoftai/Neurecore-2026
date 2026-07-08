// ─── TokenManager.ts (cookie-backed, F1; delegates to auth core) ─────────────
//
// SRP: read tokens from the auth cookies set by the backend. Tokens NEVER
// touch localStorage, so an XSS payload cannot exfiltrate them.
//
// FIX-020: this shim now delegates to the ITokenRepository in @/auth so the
// entire codebase has a single source of truth. To delete this file entirely,
// switch ISocketManager to take ITokenRepository and update the boot code.

import type { ITokenManager } from '@/core/services/api/interfaces/ITokenManager';
import { CookieTokenRepository } from '@/auth/impl/CookieTokenRepository';

const tokens = new CookieTokenRepository();

export class TokenManager implements ITokenManager {
  getAccessToken(): string | null {
    return tokens.getAccessToken();
  }

  getRefreshToken(): string | null {
    return tokens.getRefreshToken();
  }

  /** No-op: server owns persistence in HttpOnly cookies. */
  setTokens(_accessToken: string, _refreshToken: string): void {
    /* server has already set cookies via Set-Cookie */
  }

  /** Delegates to the auth core's ITokenRepository. */
  clearTokens(): void {
    tokens.clearTokens();
  }

  isTokenExpired(token: string): boolean {
    const exp = decodeExpiry(token);
    if (exp === null) return true;
    return Date.now() >= exp * 1000;
  }

  shouldRefresh(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    const exp = decodeExpiry(token);
    if (exp === null) return true;
    return Date.now() >= (exp - 60) * 1000;
  }
}

function decodeExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

/** Singleton — share across the app. */
export const tokenManager = new TokenManager();
