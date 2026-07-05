/**
 * CookieAuthClient — cookie-only auth reader (F1).
 *
 * The backend emits `__Host-nc_at`, `__Host-nc_rt`, `__Host-nc_csrf` cookies
 * on every successful login / refresh. We read them directly from
 * `document.cookie` and never store the tokens in localStorage so an XSS
 * payload cannot exfiltrate them.
 *
 * SRP:        only reads cookies + coordinates refresh.
 * OCP:        cookie names exported as constants for symmetry with backend.
 * LSP/DIP:    depends only on `document.cookie`, no DOM/storage coupling.
 */
export const ACCESS_COOKIE = '__Host-nc_at';
export const REFRESH_COOKIE = '__Host-nc_rt';
export const CSRF_COOKIE = '__Host-nc_csrf';

export interface CookieAuthSnapshot {
  accessToken: string | null;
  refreshToken: string | null;
  csrfToken: string | null;
}

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

export const cookieAuth = {
  snapshot(): CookieAuthSnapshot {
    return {
      accessToken: readCookie(ACCESS_COOKIE),
      refreshToken: readCookie(REFRESH_COOKIE),
      csrfToken: readCookie(CSRF_COOKIE),
    };
  },
  csrf(): string | null {
    return readCookie(CSRF_COOKIE);
  },
  access(): string | null {
    return readCookie(ACCESS_COOKIE);
  },
  /** Clear all auth cookies (F20 — use before redirecting to login). */
  clear(): void {
    if (typeof document === 'undefined') return;
    const past = 'Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = `${ACCESS_COOKIE}=; expires=${past}; path=/; Secure; SameSite=None`;
    document.cookie = `${REFRESH_COOKIE}=; expires=${past}; path=/; Secure; SameSite=None`;
    document.cookie = `${CSRF_COOKIE}=; expires=${past}; path=/; Secure; SameSite=None`;
  },
};

/**
 * RefreshCoordinator — F21.
 *
 * When several parallel requests hit a 401 because the access token just
 * expired (common on app-boot fetch storms), each one would otherwise
 * trigger its own `/auth/refresh` call. We share a single inflight
 * promise and await it on the rest.
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
