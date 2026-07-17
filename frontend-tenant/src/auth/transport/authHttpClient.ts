// ─── transport/authHttpClient.ts ──────────────────────────────────────────────
// Single, app-wide axios instance for auth and non-auth requests.
// Owns the CSRF request interceptor.
// The RESPONSE interceptor is attached by attachAuthInterceptor (see below)
// so it can call back to the AuthService when it detects auth failures.

import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import { CookieTokenRepository } from '../impl/CookieTokenRepository';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';

const CSRF_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google'];
const REFRESH_EXEMPT_PATHS = ['/auth/login', '/auth/register', '/auth/google', '/auth/refresh'];

export function shouldAttemptRefresh(url: string | undefined): boolean {
  if (!url) return true;
  const path = url.split('?')[0];
  return !REFRESH_EXEMPT_PATHS.some((p) => path.endsWith(p));
}

const tokens = new CookieTokenRepository();

export const authHttpClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
  timeout: 30_000,
});

authHttpClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof window === 'undefined') return config;

  const method = (config.method ?? '').toUpperCase();
  const url = config.url ?? '';
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
  const isExempt = CSRF_EXEMPT_PATHS.some((p) => url.endsWith(p));
  if (isStateChanging && !isExempt) {
    const csrf = tokens.getCsrfToken();
    if (csrf) {
      config.headers = config.headers ?? {};
      config.headers['X-CSRF-Token'] = csrf;
    }
  }
  return config;
});

export const REFRESH_URL = `${API_URL}/auth/refresh`;
