/**
 * CookieAuthClient — cookie-only auth reader (F1).
 *
 * The backend emits `__Host-nc_at`, `__Host-nc_rt`, `__Host-nc_csrf` cookies
 * on every successful login / refresh. This module is a thin shim that
 * delegates to the new ITokenRepository in `@/auth`.
 *
 * FIX-020: rewritten to delegate to the auth core. The legacy cookie-write
 * logic (and the window.location.href redirect) is gone.
 */
import { CookieTokenRepository } from '@/auth/impl/CookieTokenRepository';

export const ACCESS_COOKIE = '__Host-nc_at';
export const REFRESH_COOKIE = '__Host-nc_rt';
export const CSRF_COOKIE = '__Host-nc_csrf';

const tokens = new CookieTokenRepository();

export interface CookieAuthSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
}

export const cookieAuth = {
  snapshot(): CookieAuthSnapshot {
    return {
      accessToken: tokens.getAccessToken(),
      refreshToken: tokens.getRefreshToken(),
      csrfToken: tokens.getCsrfToken(),
    };
  },
  csrf(): string | null {
    return tokens.getCsrfToken();
  },
  access(): string | null {
    return tokens.getAccessToken();
  },
  /**
   * Clear all auth cookies — used by the legacy refresh-coordinator path.
   * The new authService.reportAuthFailure({type:'session_expired'}) is the
   * preferred entry point — killSession is atomic and never redirects.
   */
  clear(): void {
    tokens.clearTokens();
  },
};

/**
 * RefreshCoordinator (single-flight dedup of /auth/refresh calls).
 * FIX-020: still useful for non-authApi axios callers (e.g. plain fetch wrappers).
 * The new IRefreshCoordinator in @/auth/impl/SingleFlightRefreshCoordinator is
 * wired into the IAuthService. This remains for backwards compatibility.
 */
class RefreshCoordinator {
  private inflight: Promise<string | null> | null = null;

  async run(doRefresh: () => Promise<string | null>): Promise<string | null> {
    if (this.inflight) return this.inflight;
    this.inflight = (async () => {
      try {
        return await doRefresh();
      } finally {
        this.inflight = null;
      }
    })();
    return this.inflight;
  }
}

export const refreshCoordinator = new RefreshCoordinator();
