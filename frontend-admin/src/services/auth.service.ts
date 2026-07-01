import api from './api';
import { unwrapItem } from './unwrap';
import type { AuthResult, AuthUser } from '@/types/auth.types';
import type { ApiResponse } from '@/types/api.types';

export const authService = {
  async login(email: string, password: string): Promise<AuthResult> {
    const res = await api.post('/auth/login', { email, password });
    const result = unwrapItem(res) as AuthResult;
    if (result?.tokens) {
      localStorage.setItem('admin_accessToken', result.tokens.accessToken);
      localStorage.setItem('admin_refreshToken', result.tokens.refreshToken);
    }
    return result;
  },

  async me(): Promise<AuthUser> {
    const res = await api.get('/auth/me');
    return unwrapItem(res) as AuthUser;
  },

  async logout(): Promise<void> {
    await api.post('/auth/logout').catch(() => {});
    localStorage.removeItem('admin_accessToken');
    localStorage.removeItem('admin_refreshToken');
  },
};
