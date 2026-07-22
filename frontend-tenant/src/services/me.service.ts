// services/me.service.ts — Self-service endpoints for the authenticated user.
//
// Used by the Setup Center wizards:
//   ProfileWizard  → meService.profile.update()
//   OrgWizard      → meService.profile.update({ primaryDepartmentId })
//   SecurityWizard → meService.security.changePassword() / 2fa init+enable+disable
//                    / sessionTimeoutMinutes via security.update()

import { restClient } from './api';

export interface Profile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
  avatarUrl: string | null;
  phone: string | null;
  jobTitle: string | null;
  timezone: string | null;
  locale: string | null;
  language: string | null;
  theme: string | null;
  defaultLanding: string | null;
  primaryDepartmentId: string | null;
  railCollapsedDefault: boolean;
  notificationPrefs: Record<string, unknown> | null;
}

export interface ProfileUpdatePayload {
  firstName?: string;
  lastName?: string;
  phone?: string | null;
  jobTitle?: string | null;
  timezone?: string | null;
  locale?: string | null;
  language?: string | null;
  theme?: string | null;
  defaultLanding?: string | null;
  primaryDepartmentId?: string | null;
  notificationPrefs?: Record<string, unknown>;
}

export interface TwoFactorStatus {
  enabled: boolean;
  hasSecret: boolean;
  lastChallengeAt: string | null;
}

export interface SecurityStatus {
  twoFactor: TwoFactorStatus;
  sessionTimeoutMinutes: number;
}

export interface Initiate2faResponse {
  secret: string; // base32, for manual entry in authenticator app
  otpauthUri: string; // otpauth://totp/... — render as QR
}

/**
 * Safe data accessor: the backend envelopes success responses as
 * `{ status: 'success', data: T, meta }`. If `data` is missing (404 etc.)
 * the caller receives `null` and can branch.
 */
const unwrap = async <T,>(p: Promise<{ data?: T } | null | undefined>): Promise<T | null> => {
  try {
    const r = await p;
    if (!r) return null;
    return (r.data ?? null) as T | null;
  } catch {
    return null;
  }
};

const EMPTY_PROFILE: Profile = {
  id: '',
  email: '',
  firstName: '',
  lastName: '',
  role: '',
  tenantId: null,
  avatarUrl: null,
  phone: null,
  jobTitle: null,
  timezone: null,
  locale: null,
  language: null,
  theme: null,
  defaultLanding: null,
  primaryDepartmentId: null,
  railCollapsedDefault: false,
  notificationPrefs: null,
};

const EMPTY_SECURITY: SecurityStatus = {
  twoFactor: { enabled: false, hasSecret: false, lastChallengeAt: null },
  sessionTimeoutMinutes: 60,
};

class MeService {
  // ─── Profile ─────────────────────────────────────────────────────────
  profile = {
    get: async (): Promise<Profile | null> =>
      unwrap<Profile>(restClient.get<Profile>('/me/profile')),

    update: async (payload: ProfileUpdatePayload): Promise<Profile> => {
      const updated = await unwrap<Profile>(
        restClient.patch<Profile>('/me/profile', payload),
      );
      return updated ?? { ...EMPTY_PROFILE };
    },
  };

  // ─── Security: 2FA + session ────────────────────────────────────────
  security = {
    status: async (): Promise<SecurityStatus> => {
      const r = await unwrap<SecurityStatus>(
        restClient.get<SecurityStatus>('/me/security/status'),
      );
      return r ?? EMPTY_SECURITY;
    },

    /** Update security-related metadata (currently: sessionTimeoutMinutes). */
    update: async (payload: { sessionTimeoutMinutes?: number }) => {
      const r = await unwrap<{ sessionTimeoutMinutes: number }>(
        restClient.patch<{ sessionTimeoutMinutes: number }>(
          '/me/security',
          payload,
        ),
      );
      return r ?? { sessionTimeoutMinutes: payload.sessionTimeoutMinutes ?? 60 };
    },

    changePassword: (currentPassword: string, newPassword: string) =>
      restClient.post<{ message: string }>('/me/security/password', {
        currentPassword,
        newPassword,
      }),

    // ── 2FA ──
    init2fa: async () => {
      const r = await unwrap<Initiate2faResponse>(
        restClient.post<Initiate2faResponse>('/me/security/2fa/init', {}),
      );
      return r ?? { secret: '', otpauthUri: '' };
    },

    enable2fa: async (code: string) => {
      const r = await unwrap<{ enabled: boolean }>(
        restClient.post<{ enabled: boolean }>('/me/security/2fa/enable', { code }),
      );
      return r ?? { enabled: false };
    },

    disable2fa: async (password: string) => {
      const r = await unwrap<{ enabled: boolean }>(
        restClient.post<{ enabled: boolean }>('/me/security/2fa/disable', { password }),
      );
      return r ?? { enabled: true };
    },

    challenge2fa: async (code: string) => {
      const r = await unwrap<{ ok: boolean }>(
        restClient.post<{ ok: boolean }>('/me/security/2fa/challenge', { code }),
      );
      return r ?? { ok: false };
    },
  };
}

export const meService = new MeService();
export default meService;
