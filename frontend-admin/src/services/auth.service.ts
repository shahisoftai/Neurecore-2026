import api from './api';
import { unwrapItem } from './unwrap';
import type { AuthResult, AuthUser } from '@/types/auth.types';
import type { ApiResponse } from '@/types/api.types';

/**
 * AuthService — cookie-only authentication (F1).
 *
 * Tokens are NO LONGER stored in localStorage; the server sets
 * `__Host-nc_at` + `__Host-nc_rt` + `__Host-nc_csrf` cookies on successful
 * login/refresh/logout. Only the user profile lives in the auth store.
 *
 * SRP: orchestrates the auth round-trip; no persistence logic.
 * DIP: depends on the shared `api` instance and the auth store.
 */
export const authService = {
  async login(email: string, password: string): Promise<AuthResult> {
    const res = await api.post('/auth/login', { email, password });
    const result = unwrapItem(res) as AuthResult;
    return result;
  },

  async me(): Promise<AuthUser> {
    const res = await api.get('/auth/me');
    return unwrapItem(res) as AuthUser;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout').catch(() => {});
  },
};
