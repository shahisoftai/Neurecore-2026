// ─── services/api.ts (legacy axios instance, F20-era FIX-020) ─────────────────
//
// Backwards-compatible axios instance kept for stores/services that haven't
// migrated to the authHttpClient. The interceptor used to hard-redirect on 401
// (which caused the stale-user redirect loop). It now delegates to the
// IAuthService via authService.reportAuthFailure — same fix as authHttpClient.

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api.types';

import { errorHandler } from '@/core/infrastructure/ErrorHandler';
import { authService } from '@/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

const CSRF_COOKIE = '__Host-nc_csrf';
const CSRF_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google'];
const REFRESH_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh'];

function shouldAttemptRefresh(url: string | undefined): boolean {
  if (!url) return true;
  const path = url.split('?')[0];
  return !REFRESH_EXEMPT_PATHS.some((p) => path.endsWith(p));
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

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === 'undefined') return config;
  const method = (config.method ?? '').toUpperCase();
  const url = config.url ?? '';
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const isExempt = CSRF_EXEMPT_PATHS.some((p) => url.endsWith(p));
  if (isStateChanging && !isExempt) {
    const csrf = readCookie(CSRF_COOKIE);
    if (csrf) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

// FIX-020: delegate auth failures to the IAuthService instead of hard-redirecting.
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiResponse>) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !original._retry && shouldAttemptRefresh(original.url)) {
      original._retry = true;
      try {
        await axios.post<ApiResponse<{ accessToken: string }>>(
          `${API_URL}/auth/refresh`,
          {},
          {
  withCredentials: false,
            headers: {
              'Content-Type': 'application/json',
              'X-CSRF-Token': readCookie(CSRF_COOKIE) ?? '',
            },
          },
        );
        return api(original);
      } catch {
        // FIX-020: report the failure to the AuthService, never redirect.
        authService.reportAuthFailure({ type: 'session_expired' });
      }
    }

    const appError = errorHandler.fromStatus(
      error.response?.status ?? 0,
      (error.response?.data as ApiResponse)?.error?.message,
    );
    errorHandler.handle(appError);
    return Promise.reject(error);
  },
);

export default api;

export { restClient } from '@/core/services/api/clients/RestClient';
