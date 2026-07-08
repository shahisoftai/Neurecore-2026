// ─── impl/RestAuthApi.ts ──────────────────────────────────────────────────────
// SRP: Calls /auth/* via the shared authHttpClient.
// No state. No cookies. No retry/refresh logic.

import { authHttpClient } from '../transport/authHttpClient';
import type {
  IAuthApi,
  ApiResponse,
  AuthResult,
  GoogleSignInResponse,
  AuthUser,
  LoginPayload,
  RegisterPayload,
} from '../core/interfaces';
import { AuthError } from '../core/interfaces';

type AxiosEnvelope<T> = { status: 'success' | 'error'; data?: T; error?: { code: string; message: string } };

function ok<T>(status: number, data: T): ApiResponse<T> {
  return { ok: true, status, data };
}

function fail<T>(status: number, error: { code?: string; message?: string; retryAfterSeconds?: number }): ApiResponse<T> {
  return {
    ok: false,
    status,
    code: error.code ?? 'unknown',
    message: error.message ?? 'Request failed',
    retryAfterSeconds: error.retryAfterSeconds,
  };
}

async function postAuth<T>(path: string, body?: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await authHttpClient.post<AxiosEnvelope<T>>(path, body ?? {});
    if (res.data?.status === 'success' && res.data.data !== undefined) {
      return ok(res.status, res.data.data);
    }
    return fail(res.status, res.data?.error ?? { code: 'unknown', message: 'empty body' });
  } catch (err) {
    const e = err as { response?: { status: number; data?: AxiosEnvelope<T> }; message?: string };
    const status = e.response?.status ?? 0;
    const data = e.response?.data as (AxiosEnvelope<T> & { retryAfterSeconds?: number; error?: { code?: string; message?: string } }) | undefined;
    return fail(status, {
      code: data?.error?.code ?? 'unknown',
      message: data?.error?.message ?? e.message ?? 'request failed',
      retryAfterSeconds: (data as { retryAfterSeconds?: number } | undefined)?.retryAfterSeconds,
    });
  }
}

async function getAuth<T>(path: string): Promise<ApiResponse<T>> {
  try {
    const res = await authHttpClient.get<AxiosEnvelope<T>>(path);
    if (res.data?.status === 'success' && res.data.data !== undefined) {
      return ok(res.status, res.data.data);
    }
    return fail(res.status, res.data?.error ?? { code: 'unknown', message: 'empty body' });
  } catch (err) {
    const e = err as { response?: { status: number; data?: AxiosEnvelope<T> }; message?: string };
    return fail(e.response?.status ?? 0, {
      code: (e.response?.data as { error?: { code?: string; message?: string } } | undefined)?.error?.code ?? 'unknown',
      message: (e.response?.data as { error?: { code?: string; message?: string } } | undefined)?.error?.message ?? e.message ?? 'request failed',
    });
  }
}

export class RestAuthApi implements IAuthApi {
  async login(payload: LoginPayload): Promise<ApiResponse<AuthResult>> {
    return postAuth<AuthResult>('/auth/login', payload);
  }

  async register(payload: RegisterPayload): Promise<ApiResponse<AuthResult>> {
    return postAuth<AuthResult>('/auth/register', payload);
  }

  async loginWithGoogle(idToken: string, intent: 'signin' | 'link'): Promise<ApiResponse<GoogleSignInResponse>> {
    return postAuth<GoogleSignInResponse>('/auth/google', { idToken, intent });
  }

  async me(): Promise<ApiResponse<AuthUser>> {
    return getAuth<AuthUser>('/auth/me');
  }

  async refresh(): Promise<ApiResponse<{ accessToken: string; refreshToken: string; csrfToken: string }>> {
    return postAuth<{ accessToken: string; refreshToken: string; csrfToken: string }>('/auth/refresh', {});
  }

  async logout(): Promise<void> {
    try {
      await authHttpClient.post('/auth/logout');
    } catch {
      /* fire-and-forget — server clears cookies via Set-Cookie on success; ignore network errors */
    }
  }

  /** Helper used by AuthError mapping in services. */
  static mapToAuthError<T>(res: ApiResponse<T>, fallbackCode: AuthError['code'] = 'unknown'): AuthError {
    if (res.ok) return new AuthError(fallbackCode, 'unexpected ok response');
    if (res.code === 'AUTH_LOCKOUT' || res.status === 429) {
      return new AuthError('account_locked', res.message, res.retryAfterSeconds ?? 60);
    }
    if (res.code === 'CREDENTIALS_INVALID' || res.code === 'AUTHENTICATION_FAILED') {
      return new AuthError('invalid_credentials', res.message);
    }
    if (res.status === 0) {
      return new AuthError('network_error', res.message);
    }
    return new AuthError(fallbackCode, res.message);
  }
}
