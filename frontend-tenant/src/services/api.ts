// ─── services/api.ts (cookie-only legacy, F1) ────────────────────────────────
//
// Legacy Axios instance kept for backward compatibility with existing stores.
// ✅ New feature code: import { restClient } from '@/core/services/api/clients/RestClient'
// ✅ New repositories: import { agentRepository } from '@/core/repositories/AgentRepository'
//
// Token lifecycle is delegated to TokenManager (DIP, cookie-backed).

import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from 'axios';
import type { ApiResponse } from '@/types/api.types';

import { tokenManager } from '@/core/infrastructure/auth/TokenManager';
import { errorHandler } from '@/core/infrastructure/ErrorHandler';

// Same-origin by default: Next.js rewrites proxy /api/v1/* to NestJS so
// the browser sees same-origin and no CORS preflight is needed. `__Host-`
// cookies stay first-party.
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

  // F6: echo __Host-nc_csrf on state-changing calls (except exemptions).
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

// Refresh on 401
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
        // Retry — new __Host-nc_at is now in the browser jar.
        return api(original);
      } catch {
        // F20: clear before redirect
        tokenManager.clearTokens();
        if (typeof window !== 'undefined') window.location.href = '/login';
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
