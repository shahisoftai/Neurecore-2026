/**
 * Pure helpers for the Google OAuth callback redirect.
 *
 * Extracted from `IntegrationsController.googleCallback` so they can be unit-tested
 * without spinning up the Nest test harness, and so the controller stays small.
 */

export type OAuthAudience = 'tenant' | 'admin';
export type OAuthOrigin = 'settings' | 'onboarding';

export interface BuildCallbackUrlOptions {
  tenantBase: string;
  adminBase: string;
  audience: OAuthAudience;
  query: Record<string, string>;
  origin?: OAuthOrigin;
}

export function readAudienceFromState(
  state: string | undefined | null,
): OAuthAudience {
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

/** Read the `origin` flag from a base64-encoded OAuth state. Defaults to 'settings'. */
export function readOriginFromState(
  state: string | undefined | null,
): OAuthOrigin {
  if (!state) return 'settings';
  try {
    const decoded = Buffer.from(state, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(decoded);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'origin' in parsed &&
      (parsed as { origin: unknown }).origin === 'onboarding'
    ) {
      return 'onboarding';
    }
    return 'settings';
  } catch {
    return 'settings';
  }
}

export function buildCallbackRedirectUrl(
  opts: BuildCallbackUrlOptions,
): string {
  const base = (
    opts.audience === 'admin' ? opts.adminBase : opts.tenantBase
  ).replace(/\/$/, '');
  const targetPath =
    opts.origin === 'onboarding'
      ? '/onboarding/setup'
      : '/settings/integrations';
  const entries = Object.entries(opts.query).filter(
    ([, v]) => v !== undefined && v !== null && v !== '',
  );
  if (entries.length === 0) return base + targetPath;
  const search = new URLSearchParams(
    Object.fromEntries(entries.map(([k, v]) => [k, String(v)])),
  ).toString();
  return `${base}${targetPath}?${search}`;
}
