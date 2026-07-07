/**
 * Pure-helper unit tests for the Google OAuth callback redirect logic.
 *
 * Covers G1 (absolute redirect + tenant/admin audience routing).
 */

import {
  readAudienceFromState,
  buildCallbackRedirectUrl,
} from './oauth-callback.util';

const encodeState = (payload: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64');

describe('readAudienceFromState', () => {
  it('defaults to tenant for missing or empty state', () => {
    expect(readAudienceFromState(undefined)).toBe('tenant');
    expect(readAudienceFromState(null)).toBe('tenant');
    expect(readAudienceFromState('')).toBe('tenant');
  });

  it("returns 'admin' when state payload has audience='admin'", () => {
    const state = encodeState({ tenantId: 't1', audience: 'admin' });
    expect(readAudienceFromState(state)).toBe('admin');
  });

  it("returns 'tenant' when state payload has audience='tenant'", () => {
    const state = encodeState({ tenantId: 't1', audience: 'tenant' });
    expect(readAudienceFromState(state)).toBe('tenant');
  });

  it("returns 'tenant' when state payload omits audience", () => {
    const state = encodeState({ tenantId: 't1' });
    expect(readAudienceFromState(state)).toBe('tenant');
  });

  it('returns tenant for malformed base64', () => {
    expect(readAudienceFromState('not-base64-!!!')).toBe('tenant');
  });

  it('returns tenant for valid base64 that is not JSON', () => {
    const junk = Buffer.from('not json', 'utf-8').toString('base64');
    expect(readAudienceFromState(junk)).toBe('tenant');
  });
});

describe('buildCallbackRedirectUrl', () => {
  const tenantBase = 'https://hq.neurecore.com';
  const adminBase = 'https://cc.neurecore.com';

  it('builds absolute tenant URL when audience is tenant', () => {
    const url = buildCallbackRedirectUrl({
      tenantBase,
      adminBase,
      audience: 'tenant',
      query: {},
    });
    expect(url).toBe('https://hq.neurecore.com/settings/integrations');
  });

  it('builds absolute admin URL when audience is admin', () => {
    const url = buildCallbackRedirectUrl({
      tenantBase,
      adminBase,
      audience: 'admin',
      query: {},
    });
    expect(url).toBe('https://cc.neurecore.com/settings/integrations');
  });

  it('strips a trailing slash on the base URL', () => {
    const url = buildCallbackRedirectUrl({
      tenantBase: 'https://hq.neurecore.com/',
      adminBase: 'https://cc.neurecore.com/',
      audience: 'tenant',
      query: { connected: 'true' },
    });
    expect(url).toBe('https://hq.neurecore.com/settings/integrations?connected=true');
  });

  it('appends query parameters verbatim', () => {
    const url = buildCallbackRedirectUrl({
      tenantBase,
      adminBase,
      audience: 'tenant',
      query: { connected: 'true', email: 'ops@example.com' },
    });
    expect(url).toContain('connected=true');
    expect(url).toContain('email=ops%40example.com');
  });

  it('drops undefined/empty query values', () => {
    const url = buildCallbackRedirectUrl({
      tenantBase,
      adminBase,
      audience: 'tenant',
      query: { connected: 'true', email: '', extra: undefined as unknown as string },
    });
    expect(url).toBe('https://hq.neurecore.com/settings/integrations?connected=true');
  });

  it('regression: never returns a relative URL (the original G1 bug)', () => {
    const url = buildCallbackRedirectUrl({
      tenantBase,
      adminBase,
      audience: 'tenant',
      query: { connected: 'true' },
    });
    expect(url.startsWith('http')).toBe(true);
    expect(url.startsWith('/')).toBe(false);
  });
});
