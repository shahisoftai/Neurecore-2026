// ─── __tests__/auth-route-registry.spec.ts ────────────────────────────────────

import { describe, it, expect } from 'vitest';
import { AuthRouteRegistry } from '@/auth/impl/AuthRouteRegistry';

describe('AuthRouteRegistry (tenant)', () => {
  const reg = new AuthRouteRegistry();

  it('identifies unauthenticated routes by pattern', () => {
    expect(reg.isUnauthenticatedRoute('/login')).toBe(true);
    expect(reg.isUnauthenticatedRoute('/register')).toBe(true);
    expect(reg.isUnauthenticatedRoute('/forgot-password')).toBe(true);
    expect(reg.isUnauthenticatedRoute('/reset-password')).toBe(true);
    expect(reg.isUnauthenticatedRoute('/privacy')).toBe(true);
    expect(reg.isUnauthenticatedRoute('/terms')).toBe(true);
    expect(reg.isUnauthenticatedRoute('/onboarding/setup')).toBe(true);
  });

  it('rejects authenticated routes', () => {
    expect(reg.isUnauthenticatedRoute('/home')).toBe(false);
    expect(reg.isUnauthenticatedRoute('/command-center')).toBe(false);
    expect(reg.isUnauthenticatedRoute('/')).toBe(false);
    expect(reg.isUnauthenticatedRoute('/intelligence')).toBe(false);
  });

  it('returns the correct URLs', () => {
    expect(reg.getLoginUrl()).toBe('/login');
    expect(reg.getPostAuthUrl()).toBe('/home');
  });
});
