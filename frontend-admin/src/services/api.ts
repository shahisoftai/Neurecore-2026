import axios, {
  AxiosInstance,
  InternalAxiosRequestConfig,
  AxiosError,
  AxiosResponse,
} from 'axios';
import { unwrapItem } from './unwrap';
import { parseApiError, logError, AppError } from '@/lib/errors';
import { cookieAuth, refreshCoordinator } from './cookieAuth';

// Same-origin by default: Next.js's `rewrites()` proxies /api/v1/* to the
// NestJS backend so the browser sees same-origin and no CORS preflight is
// needed. `__Host-` cookies stay first-party.
// Override with NEXT_PUBLIC_API_URL for fully-split deployments.
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  // withCredentials: false — cookies are sent automatically on same-origin
  // requests regardless. Keeping it false avoids redundant CORS preflight
  // when the backend and frontend share an origin.
  withCredentials: false,
  timeout: 30000,
});

// ─── Request interceptor ────────────────────────────────────────────────────
//
// F1: NO Bearer header — cookies travel automatically (same-origin). 
// F6: CSRF double-submit — echo the __Host-nc_csrf cookie as X-CSRF-Token
// on every state-changing method, except for auth endpoints where the CSRF
// middleware is permissive (the browser has no token yet).

const CSRF_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google'];

function shouldAttachCsrf(method: string | undefined, url: string | undefined): boolean {
  if (!method || !url) return false;
  const m = method.toUpperCase();
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(m)) return false;
  const path = url.split('?')[0];
  return !CSRF_EXEMPT_PATHS.some((p) => path.endsWith(p));
}

// Auth endpoints that must NEVER trigger a token refresh. A 401 on /auth/login
// means bad credentials (not an expired session), and a 401 on /auth/refresh
// means the refresh token is invalid. Retrying with a refresh would create
// either a redirect loop or clear valid cookies that aren't the problem.
const REFRESH_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh'];

function shouldAttemptRefresh(url: string | undefined): boolean {
  if (!url) return true;
  const path = url.split('?')[0];
  return !REFRESH_EXEMPT_PATHS.some((p) => path.endsWith(p));
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === 'undefined') return config;

  try {
    const csrf = cookieAuth.csrf();
    if (csrf && shouldAttachCsrf(config.method, config.url)) {
      config.headers = config.headers || {};
      config.headers['X-CSRF-Token'] = csrf;
    }
  } catch {
    /* never break requests */
  }

  return config;
});

// ─── Response interceptor ───────────────────────────────────────────────────

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = (error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    }) || {};

    try {
      logError(error, {
        url: original?.url,
        method: original?.method,
        status: error.response?.status,
      });
    } catch {
      /* noop */
    }

    if (!error.response) {
      return Promise.reject(
        new AppError('Network error or backend unreachable', 'NETWORK_ERROR', 503),
      );
    }

    if (error.response.status === 401 && !original._retry && shouldAttemptRefresh(original.url)) {
      original._retry = true;

      const newAccess = await refreshCoordinator.run(async () => {
        try {
          const resp = await axios.post<AxiosResponse>(
            `${API_URL}/auth/refresh`,
            {},
            {
              withCredentials: false,
              headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': cookieAuth.csrf() ?? '',
              },
              timeout: 5000,
            },
          );
          const tokens = unwrapItem(resp);
          return tokens?.accessToken ?? null;
        } catch {
          return null;
        }
      });

      if (!newAccess) {
        if (typeof window !== 'undefined') {
          cookieAuth.clear();
          const origin = window.location.origin || '';
          if (!window.location.pathname.includes('/login')) {
            window.location.href = origin + '/login';
          }
        }
        return Promise.reject(
          new AppError('Session expired. Please log in again.', 'TOKEN_EXPIRED', 401),
        );
      }

      // Server has rotated __Host-nc_at via Set-Cookie. The browser picked
      // it up automatically on the refresh response. Retry the original
      // request — it will send the new cookie.
      return api(original);
    }

    const appError = parseApiError(error);

    if (
      ['TOKEN_EXPIRED', 'TOKEN_INVALID', 'REFRESH_TOKEN_EXPIRED'].includes(
        appError.code,
      )
    ) {
      try {
        if (typeof window !== 'undefined') {
          cookieAuth.clear();
          const origin = window.location.origin || '';
          if (!window.location.pathname.includes('/login')) {
            window.location.href = origin + '/login';
          }
        }
      } catch {
        /* noop */
      }
    }

    return Promise.reject(appError);
  },
);

export async function apiCall<T>(
  requestFn: () => Promise<{ data: T }>,
): Promise<T> {
  const response = await requestFn();
  return response.data;
}

export { AppError };
export default api;
