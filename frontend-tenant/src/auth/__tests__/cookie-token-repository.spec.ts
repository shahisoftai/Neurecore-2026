// ─── __tests__/cookie-token-repository.spec.ts ───────────────────────────────

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CookieTokenRepository, ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE } from '@/auth/impl/CookieTokenRepository';

describe('CookieTokenRepository', () => {
  let repo: CookieTokenRepository;

  beforeEach(() => {
    document.cookie = '';
    repo = new CookieTokenRepository();
  });

  it('returns null when no cookies are set', () => {
    expect(repo.getAccessToken()).toBeNull();
    expect(repo.getRefreshToken()).toBeNull();
    expect(repo.getCsrfToken()).toBeNull();
  });

  it('reads a previously-set __Host-nc_at cookie', () => {
    document.cookie = `${ACCESS_COOKIE}=test-access; path=/; Secure`;
    expect(repo.getAccessToken()).toBe('test-access');
  });

  it('reads all three cookies independently', () => {
    document.cookie = `${ACCESS_COOKIE}=at; path=/; Secure`;
    document.cookie = `${REFRESH_COOKIE}=rt; path=/; Secure`;
    document.cookie = `${CSRF_COOKIE}=ct; path=/; Secure`;
    expect(repo.getAccessToken()).toBe('at');
    expect(repo.getRefreshToken()).toBe('rt');
    expect(repo.getCsrfToken()).toBe('ct');
  });

  it('clears all three cookies atomically', () => {
    document.cookie = `${ACCESS_COOKIE}=at; path=/; Secure`;
    document.cookie = `${REFRESH_COOKIE}=rt; path=/; Secure`;
    document.cookie = `${CSRF_COOKIE}=ct; path=/; Secure`;
    repo.clearTokens();
    expect(repo.getAccessToken()).toBeNull();
    expect(repo.getRefreshToken()).toBeNull();
    expect(repo.getCsrfToken()).toBeNull();
  });

  it('setAccessToken is a no-op (server owns cookie persistence)', () => {
    expect(() => repo.setAccessToken('whatever')).not.toThrow();
    expect(repo.getAccessToken()).not.toBe('whatever');
  });

  it('NEVER touches localStorage or sessionStorage', () => {
    const lsSpy = vi.spyOn(Storage.prototype, 'setItem');
    const ssSpy = vi.spyOn(Storage.prototype, 'setItem');
    repo.setAccessToken('x');
    repo.clearTokens();
    expect(lsSpy).not.toHaveBeenCalled();
    expect(ssSpy).not.toHaveBeenCalled();
  });
});
