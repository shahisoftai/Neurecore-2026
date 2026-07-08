// ─── transport/authResponseInterceptor.ts ─────────────────────────────────────
// The contract from memory-bank/plans/auth-hardening-refactor.md §2.4.
// The interceptor NEVER directly redirects. It only calls the auth failure callback.

import type { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import type { AuthFailureCallback } from '../core/interfaces';

const REFRESH_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh'];

function shouldAttemptRefresh(url: string | undefined): boolean {
  if (!url) return true;
  const path = url.split('?')[0];
  return !REFRESH_EXEMPT_PATHS.some((p) => path.endsWith(p));
}

function isRefreshUrl(url: string | undefined): boolean {
  if (!url) return false;
  const path = url.split('?')[0];
  return path.endsWith('/auth/refresh');
}

type RetryConfig = InternalAxiosRequestConfig & { _authRetry?: boolean; _authRefreshTried?: boolean };

export function attachAuthInterceptor(client: AxiosInstance, onAuthFailure: AuthFailureCallback): void {
  client.interceptors.response.use(
    (res) => res,
    async (error: AxiosError) => {
      const original = (error.config as RetryConfig | undefined) ?? ({} as RetryConfig);
      const status = error.response?.status;

      // ─── Network errors: pass through. NEVER clear the session on network failures.
      if (!status) {
        return Promise.reject(error);
      }

      // ─── 401 path ─────────────────────────────────────────────────────────
      if (status === 401) {
        // 4a) refresh URL itself returned 401 → token is invalid
        if (isRefreshUrl(original.url)) {
          onAuthFailure({ type: 'token_invalid' });
          return Promise.reject(error);
        }

        // 4b) Other exempt paths (login/register/google) → just pass through.
        if (!shouldAttemptRefresh(original.url)) {
          return Promise.reject(error);
        }

        // 4c) Already retried → session_expired
        if (original._authRetry) {
          onAuthFailure({ type: 'session_expired' });
          return Promise.reject(error);
        }

        // 4d) First 401 on a protected URL → mark for retry; the AUTH layer's
        //     SingleFlightRefreshCoordinator handles the actual refresh.
        original._authRetry = true;
        try {
          return await client.request(original);
        } catch {
          onAuthFailure({ type: 'session_expired' });
          return Promise.reject(error);
        }
      }

      // ─── 429 on /auth/login → lockout
      if (status === 429 && original.url?.includes('/auth/login')) {
        const retryAfterSeconds =
          (error.response?.data as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds ?? 60;
        onAuthFailure({ type: 'locked_out', retryAfterSeconds });
        return Promise.reject(error);
      }

      // ─── 5xx / 4xx-non-401-non-429: pass through.
      return Promise.reject(error);
    },
  );
}
