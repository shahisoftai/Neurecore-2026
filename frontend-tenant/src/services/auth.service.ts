import api from './api';
import type { AuthResult, LoginPayload, RegisterPayload, AuthUser } from '@/types/auth.types';
import { unwrapItem } from '@/services/unwrap';

export type GoogleSignInResponse =
  | { status: 'ok'; user: AuthUser; tokens: { accessToken: string; refreshToken: string; expiresIn: number } }
  | { status: 'existing_unlinked'; email: string; firstName: string; lastName: string; googlePicture?: string; googleId: string }
  | { status: 'conflict'; email: string; message: string };

export const authService = {
  async login(payload: LoginPayload): Promise<AuthResult> {
    const res = await api.post('/auth/login', payload);
    const result = unwrapItem(res) as AuthResult;
    return result;
  },

  async googleSignIn(
    idToken: string,
    intent: 'signin' | 'link' = 'signin',
  ): Promise<GoogleSignInResponse> {
    const res = await api.post('/auth/google', { idToken, intent });
    const result = unwrapItem(res) as GoogleSignInResponse;
    return result;
  },

  async register(payload: RegisterPayload): Promise<AuthResult> {
    const res = await api.post('/auth/register', payload);
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

  async forgotPassword(email: string): Promise<void> {
    await api.post('/auth/forgot-password', { email });
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    await api.post('/auth/reset-password', { token, newPassword });
  },
};
