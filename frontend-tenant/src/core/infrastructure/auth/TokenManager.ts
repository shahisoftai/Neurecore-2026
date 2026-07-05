// ─── TokenManager.ts (cookie-backed, F1) ─────────────────────────────────────
//
// Single Responsibility: read tokens from the auth cookies set by the
// backend. Tokens NEVER touch localStorage, so an XSS payload cannot
// exfiltrate them. setTokens / clearTokens become no-ops because the
// server is the source of truth.
//
// Dependency Inversion: this implementation reads only document.cookie.
// The interface above (ITokenManager) is unchanged so callers don't have
// to know about the storage switch.

export const ACCESS_COOKIE = '__Host-nc_at';
export const REFRESH_COOKIE = '__Host-nc_rt';
export const CSRF_COOKIE = '__Host-nc_csrf';

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const cookies = document.cookie ? document.cookie.split('; ') : [];
  for (const raw of cookies) {
    const eq = raw.indexOf('=');
    if (eq < 0) continue;
    const key = raw.slice(0, eq);
    if (key === name) {
      const v = raw.slice(eq + 1);
      try {
        return decodeURIComponent(v);
      } catch {
        return v;
      }
    }
  }
  return null;
}

/** Decode the `exp` claim from a JWT without verifying the signature. */
function decodeExpiry(token: string): number | null {
  try {
    const [, payload] = token.split('.');
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch {
    return null;
  }
}

export class TokenManager {
  getAccessToken(): string | null {
    return readCookie(ACCESS_COOKIE);
  }

  getRefreshToken(): string | null {
    return readCookie(REFRESH_COOKIE);
  }

  /**
   * No-op — the backend owns token persistence in HttpOnly cookies.
   * Kept on the interface so call-sites don't need to know.
   */
  setTokens(_accessToken: string, _refreshToken: string): void {
    /* server has already set cookies via Set-Cookie */
  }

  /**
   * Clear all auth cookies before redirecting (F20).
   */
  clearTokens(): void {
    if (typeof document === 'undefined') return;
    const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = `${ACCESS_COOKIE}=; expires=${past}; path=/; Secure; SameSite=None`;
    document.cookie = `${REFRESH_COOKIE}=; expires=${past}; path=/; Secure; SameSite=None`;
    document.cookie = `${CSRF_COOKIE}=; expires=${past}; path=/; Secure; SameSite=None`;
  }

  isTokenExpired(token: string): boolean {
    const exp = decodeExpiry(token);
    if (exp === null) return true;
    return Date.now() >= exp * 1000;
  }

  /** Returns true when < 60 s remain before the access token expires. */
  shouldRefresh(): boolean {
    const token = this.getAccessToken();
    if (!token) return true;
    const exp = decodeExpiry(token);
    if (exp === null) return true;
    return Date.now() >= (exp - 60) * 1000;
  }
}

/** Singleton — share across the app. */
export const tokenManager = new TokenManager();
