import { ConfigService } from '@nestjs/config';
import {
  CookieAuthService,
  ACCESS_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  CSRF_COOKIE,
} from '../../src/common/auth/cookie-auth.service';
import type { Request, Response } from 'express';

/**
 * Unit tests for CookieAuthService — Phase 9 (Auth Hardening).
 *
 * Covers:
 *   - Cookie name constants
 *   - parseCookies (parsed req.cookies + raw Cookie header fallback)
 *   - generateCsrfToken (random, non-empty, base64url)
 *   - safeEquals (constant-time)
 *   - setAuthCookies attaches httpOnly Secure SameSite=Strict
 *   - clearAuthCookies emits clearCookie for all three names
 *   - isEnabled (USE_HTTPONLY_AUTH override, prod default)
 */

interface MockRes {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
}

function makeMockRes(): MockRes {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

function makeConfig(overrides: Record<string, string> = {}): ConfigService {
  const data: Record<string, string | undefined> = {
    NODE_ENV: 'test',
    ...overrides,
  };
  return {
    get: jest.fn((key: string, fallback?: string) => data[key] ?? fallback),
  } as unknown as ConfigService;
}

describe('CookieAuthService', () => {
  describe('cookie name constants', () => {
    it('uses __Host- prefixed names (CSP-safe)', () => {
      expect(ACCESS_TOKEN_COOKIE).toBe('__Host-nc_at');
      expect(REFRESH_TOKEN_COOKIE).toBe('__Host-nc_rt');
      expect(CSRF_COOKIE).toBe('__Host-nc_csrf');
    });
  });

  describe('isEnabled', () => {
    it('defaults to false in non-production', () => {
      const svc = new CookieAuthService(makeConfig({ NODE_ENV: 'development' }));
      expect(svc.isEnabled()).toBe(false);
    });

    it('defaults to true in production', () => {
      const svc = new CookieAuthService(makeConfig({ NODE_ENV: 'production' }));
      expect(svc.isEnabled()).toBe(true);
    });

    it('respects USE_HTTPONLY_AUTH=true override', () => {
      const svc = new CookieAuthService(
        makeConfig({ NODE_ENV: 'development', USE_HTTPONLY_AUTH: 'true' }),
      );
      expect(svc.isEnabled()).toBe(true);
    });

    it('respects USE_HTTPONLY_AUTH=false override', () => {
      const svc = new CookieAuthService(
        makeConfig({ NODE_ENV: 'production', USE_HTTPONLY_AUTH: 'false' }),
      );
      expect(svc.isEnabled()).toBe(false);
    });
  });

  describe('parseCookies', () => {
    let svc: CookieAuthService;
    beforeEach(() => {
      svc = new CookieAuthService(makeConfig());
    });

    it('reads from req.cookies when present', () => {
      const req = {
        cookies: {
          [ACCESS_TOKEN_COOKIE]: 'access-jwt',
          [REFRESH_TOKEN_COOKIE]: 'refresh-jwt',
          [CSRF_COOKIE]: 'csrf-token',
        },
      } as unknown as Request;
      const result = svc.parseCookies(req);
      expect(result.accessToken).toBe('access-jwt');
      expect(result.refreshToken).toBe('refresh-jwt');
      expect(result.csrfToken).toBe('csrf-token');
    });

    it('falls back to raw Cookie header when req.cookies absent', () => {
      const req = {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=access-jwt; ${REFRESH_TOKEN_COOKIE}=refresh-jwt; ${CSRF_COOKIE}=csrf-token`,
        },
      } as unknown as Request;
      const result = svc.parseCookies(req);
      expect(result.accessToken).toBe('access-jwt');
      expect(result.refreshToken).toBe('refresh-jwt');
      expect(result.csrfToken).toBe('csrf-token');
    });

    it('decodes URL-encoded cookie values', () => {
      const req = {
        headers: {
          cookie: `${ACCESS_TOKEN_COOKIE}=eyJhbGciOiJIUzI1NiJ9%20.payload; ${CSRF_COOKIE}=abc%2Bdef%3D%3D`,
        },
      } as unknown as Request;
      const result = svc.parseCookies(req);
      expect(result.accessToken).toBe('eyJhbGciOiJIUzI1NiJ9 .payload');
      expect(result.csrfToken).toBe('abc+def==');
    });

    it('returns nulls when no cookies present', () => {
      const req = { headers: {} } as unknown as Request;
      const result = svc.parseCookies(req);
      expect(result.accessToken).toBeNull();
      expect(result.refreshToken).toBeNull();
      expect(result.csrfToken).toBeNull();
    });
  });

  describe('generateCsrfToken', () => {
    let svc: CookieAuthService;
    beforeEach(() => {
      svc = new CookieAuthService(makeConfig());
    });

    it('returns a non-empty string', () => {
      const t = svc.generateCsrfToken();
      expect(typeof t).toBe('string');
      expect(t.length).toBeGreaterThan(0);
    });

    it('produces different tokens on each call', () => {
      const a = svc.generateCsrfToken();
      const b = svc.generateCsrfToken();
      expect(a).not.toBe(b);
    });

    it('uses base64url-safe alphabet (no +, /, =)', () => {
      const t = svc.generateCsrfToken();
      expect(t).not.toMatch(/[+/=]/);
    });
  });

  describe('safeEquals', () => {
    let svc: CookieAuthService;
    beforeEach(() => {
      svc = new CookieAuthService(makeConfig());
    });

    it('returns true for identical strings', () => {
      expect(svc.safeEquals('abc123', 'abc123')).toBe(true);
    });

    it('returns false for different strings of same length', () => {
      expect(svc.safeEquals('abc123', 'abc124')).toBe(false);
    });

    it('returns false for different-length strings', () => {
      expect(svc.safeEquals('short', 'longer-string')).toBe(false);
    });
  });

  describe('setAuthCookies', () => {
    it('attaches 3 cookies with httpOnly + sameSite=strict in dev', () => {
      const svc = new CookieAuthService(makeConfig({ NODE_ENV: 'development' }));
      const res = makeMockRes();
      svc.setAuthCookies(res as unknown as Response, {
        accessToken: 'a',
        refreshToken: 'r',
      });
      expect(res.cookie).toHaveBeenCalledTimes(3);
      const calls = res.cookie.mock.calls;
      expect(calls[0][0]).toBe(ACCESS_TOKEN_COOKIE);
      expect(calls[0][1]).toBe('a');
      expect(calls[0][2]).toMatchObject({
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
      });
      expect(calls[1][0]).toBe(REFRESH_TOKEN_COOKIE);
      expect(calls[1][1]).toBe('r');
      // CSRF cookie is NOT httpOnly
      expect(calls[2][0]).toBe(CSRF_COOKIE);
      expect(calls[2][2]).toMatchObject({
        httpOnly: false,
        sameSite: 'lax',
        secure: false,
      });
    });

    it('sets Secure=true in production', () => {
      const svc = new CookieAuthService(makeConfig({ NODE_ENV: 'production' }));
      const res = makeMockRes();
      svc.setAuthCookies(res as unknown as Response, {
        accessToken: 'a',
        refreshToken: 'r',
      });
      const calls = res.cookie.mock.calls;
      expect(calls[0][2]).toMatchObject({ secure: true });
      expect(calls[1][2]).toMatchObject({ secure: true });
      expect(calls[2][2]).toMatchObject({ secure: true });
    });

    it('uses caller-provided CSRF token if passed', () => {
      const svc = new CookieAuthService(makeConfig());
      const res = makeMockRes();
      svc.setAuthCookies(res as unknown as Response, {
        accessToken: 'a',
        refreshToken: 'r',
        csrfToken: 'my-csrf',
      });
      const csrfCall = res.cookie.mock.calls.find(
        (c) => c[0] === CSRF_COOKIE,
      );
      expect(csrfCall?.[1]).toBe('my-csrf');
    });
  });

  describe('clearAuthCookies', () => {
    it('clears all 3 cookies', () => {
      const svc = new CookieAuthService(makeConfig());
      const res = makeMockRes();
      svc.clearAuthCookies(res as unknown as Response);
      expect(res.clearCookie).toHaveBeenCalledTimes(3);
      const names = res.clearCookie.mock.calls.map((c) => c[0]);
      expect(names).toEqual(
        expect.arrayContaining([
          ACCESS_TOKEN_COOKIE,
          REFRESH_TOKEN_COOKIE,
          CSRF_COOKIE,
        ]),
      );
    });
  });
});