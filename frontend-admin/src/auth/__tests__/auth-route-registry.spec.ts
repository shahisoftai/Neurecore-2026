// ─── __tests__/auth-route-registry.spec.ts (admin) ────────────────────────────

import { describe, it, expect } from 'vitest';
import { AuthRouteRegistry } from '@/auth/impl/AuthRouteRegistry';

describe('AuthRouteRegistry (admin)', () => {
  const reg = new AuthRouteRegistry();

  it('identifies the login route as unauthenticated', () => {
    expect(reg.isUnauthenticatedRoute('/login')).toBe(true);
  });

  it('rejects authenticated routes', () => {
    expect(reg.isUnauthenticatedRoute('/overview')).toBe(false);
    expect(reg.isUnauthenticatedRoute('/')).toBe(false);
    expect(reg.isUnauthenticatedRoute('/agents')).toBe(false);
  });

  it('returns the correct URLs', () => {
    expect(reg.getLoginUrl()).toBe('/login');
    expect(reg.getPostAuthUrl()).toBe('/overview');
  });
});
