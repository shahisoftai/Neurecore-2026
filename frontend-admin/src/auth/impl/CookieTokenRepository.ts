// ─── impl/CookieTokenRepository.ts ────────────────────────────────────────────
// SRP: Cookie I/O only. NEVER touches localStorage/sessionStorage.
// DIP: Implements ITokenRepository from the core.

import type { ITokenRepository } from '../core/interfaces';

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

function clearCookie(name: string): void {
  if (typeof document === 'undefined') return;
  const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
  document.cookie = `${name}=; expires=${past}; path=/; Secure; SameSite=None`;
}

export class CookieTokenRepository implements ITokenRepository {
  getAccessToken(): string | null {
    return readCookie(ACCESS_COOKIE);
  }

  getRefreshToken(): string | null {
    return readCookie(REFRESH_COOKIE);
  }

  getCsrfToken(): string | null {
    return readCookie(CSRF_COOKIE);
  }

  /**
   * No-op — the backend owns token persistence in HttpOnly cookies.
   * Kept on the interface so call-sites don't need to know.
   */
  setAccessToken(_at: string): void {
    /* server has already set cookies via Set-Cookie */
  }

  clearTokens(): void {
    clearCookie(ACCESS_COOKIE);
    clearCookie(REFRESH_COOKIE);
    clearCookie(CSRF_COOKIE);
  }
}
