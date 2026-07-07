/**
 * Pure helpers for the Google OAuth callback redirect.
 *
 * Extracted from `IntegrationsController.googleCallback` so they can be unit-tested
 * without spinning up the Nest test harness, and so the controller stays small.
 */

export type OAuthAudience = 'tenant' | 'admin';

export interface BuildCallbackUrlOptions {
  tenantBase: string;
  adminBase: string;
  audience: OAuthAudience;
  query: Record<string, string>;
}

export function readAudienceFromState(state: string | undefined | null): OAuthAudience {
  if (!state) return 'tenant';
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(decoded);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'audience' in parsed &&
      (parsed as { audience: unknown }).audience === 'admin'
    ) {
      return 'admin';
    }
    return 'tenant';
  } catch {
    return 'tenant';
  }
}

export function buildCallbackRedirectUrl(opts: BuildCallbackUrlOptions): string {
  const base = (opts.audience === 'admin' ? opts.adminBase : opts.tenantBase)
    .replace(/\/$/, '');
  const entries = Object.entries(opts.query).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return base + '/settings/integrations';
  const search = new URLSearchParams(
    Object.fromEntries(entries.map(([k, v]) => [k, String(v)])),
  ).toString();
  return `${base}/settings/integrations?${search}`;
}
