/**
 * FeatureFlagService unit tests — Phase H (2026-07-19).
 *
 * HERMES_ENABLED was retired in Phase H — Hermes is now the sole execution
 * path. These tests verify that:
 *   - HERMES_AUTO_LINK is the only Hermes-related global flag (default true)
 *   - All other flags default to false unless explicitly set
 *   - Per-tenant overrides still work for HERMES_AUTO_LINK
 *   - Unknown flags (including retired HERMES_ENABLED) fail-closed globally
 *   - Per-tenant overrides stored under HERMES_ENABLED are still read by
 *     getTenantOverride() (backward compat with stored data) but default to
 *     false since the global value is unknown.
 */

import { FeatureFlagService } from '../../src/common/feature-flag/feature-flag.service';

function makePrisma(settings: Record<string, unknown> | null = null) {
  return {
    tenant: {
      findUnique: jest.fn().mockResolvedValue(
        settings === null ? null : { settings },
      ),
      update: jest.fn().mockResolvedValue({}),
    },
  } as never;
}

function makeConfig(values: Record<string, string | undefined> = {}) {
  return {
    get: jest.fn((key: string) => values[key]),
  } as never;
}

describe('FeatureFlagService (global mode — no Prisma)', () => {
  it('reads HERMES_AUTO_LINK from env', () => {
    const svc = new FeatureFlagService(makeConfig({ HERMES_AUTO_LINK: 'false' }));
    svc.refresh();
    expect(svc.isEnabled('HERMES_AUTO_LINK')).toBe(false);
  });

  it('unknown flags fail-closed', () => {
    const svc = new FeatureFlagService(makeConfig({}));
    svc.refresh();
    expect(svc.isEnabled('UNKNOWN_FLAG')).toBe(false);
    expect(svc.isDisabled('UNKNOWN_FLAG')).toBe(true);
  });

  it('defaults HERMES_AUTO_LINK to true when env is unset', () => {
    const svc = new FeatureFlagService(makeConfig({}));
    svc.refresh();
    expect(svc.isEnabled('HERMES_AUTO_LINK')).toBe(true);
  });

  it('retired HERMES_ENABLED flag is unknown (fail-closed globally)', () => {
    const svc = new FeatureFlagService(makeConfig({ HERMES_ENABLED: 'true' }));
    svc.refresh();
    expect(svc.isEnabled('HERMES_ENABLED')).toBe(false);
  });

  it('refresh() picks up env changes', () => {
    const cfg = makeConfig({ HERMES_AUTO_LINK: 'false' });
    const svc = new FeatureFlagService(cfg);
    svc.refresh();
    expect(svc.isEnabled('HERMES_AUTO_LINK')).toBe(false);
    (cfg.get as jest.Mock).mockImplementation((k: string) =>
      k === 'HERMES_AUTO_LINK' ? 'true' : undefined,
    );
    svc.refresh();
    expect(svc.isEnabled('HERMES_AUTO_LINK')).toBe(true);
  });

  it('knownFlags() does NOT include retired HERMES_ENABLED', () => {
    const svc = new FeatureFlagService(makeConfig({}));
    svc.refresh();
    const names = svc.knownFlags();
    expect(names).not.toContain('HERMES_ENABLED');
    expect(names).toEqual(
      expect.arrayContaining([
        'DISABLE_AI_ACTIONS',
        'HERMES_AUTO_LINK',
        'HERMES_APPROVAL_REQUIRED',
        'HERMES_SESSION_LOGGING',
      ]),
    );
  });
});

describe('FeatureFlagService (per-tenant overrides — with Prisma)', () => {
  it('global default applies when no tenant override is set', async () => {
    const prisma = makePrisma(null);
    const svc = new FeatureFlagService(
      makeConfig({ HERMES_AUTO_LINK: 'true' }),
      prisma,
    );
    svc.refresh();
    expect(await svc.isEnabled('HERMES_AUTO_LINK', 't1')).toBe(true);
  });

  it('per-tenant override wins over global default', async () => {
    const prisma = makePrisma({
      featureFlags: { HERMES_AUTO_LINK: false },
    });
    const svc = new FeatureFlagService(
      makeConfig({ HERMES_AUTO_LINK: 'true' }),
      prisma,
    );
    svc.refresh();
    expect(await svc.isEnabled('HERMES_AUTO_LINK', 't1')).toBe(false);
    expect(await svc.isDisabled('HERMES_AUTO_LINK', 't1')).toBe(true);
  });

  it('per-tenant `true` overrides global `false`', async () => {
    const prisma = makePrisma({
      featureFlags: { HERMES_AUTO_LINK: true },
    });
    const svc = new FeatureFlagService(
      makeConfig({ HERMES_AUTO_LINK: 'false' }),
      prisma,
    );
    svc.refresh();
    expect(await svc.isEnabled('HERMES_AUTO_LINK', 't1')).toBe(true);
  });

  it('caches tenant overrides across calls', async () => {
    const prisma = makePrisma({
      featureFlags: { HERMES_AUTO_LINK: true },
    });
    const svc = new FeatureFlagService(makeConfig({}), prisma);
    svc.refresh();
    await svc.isEnabled('HERMES_AUTO_LINK', 't1');
    await svc.isEnabled('HERMES_AUTO_LINK', 't1');
    // Only one DB read for the same tenant.
    expect(prisma.tenant.findUnique as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('invalidateTenantOverrides forces a re-read', async () => {
    const prisma = makePrisma({ featureFlags: { HERMES_AUTO_LINK: true } });
    const svc = new FeatureFlagService(makeConfig({}), prisma);
    svc.refresh();
    await svc.isEnabled('HERMES_AUTO_LINK', 't1');
    svc.invalidateTenantOverrides('t1');
    await svc.isEnabled('HERMES_AUTO_LINK', 't1');
    expect(prisma.tenant.findUnique as jest.Mock).toHaveBeenCalledTimes(2);
  });

  it('ignores non-boolean values in tenant.settings.featureFlags', async () => {
    const prisma = makePrisma({
      featureFlags: { HERMES_AUTO_LINK: 'yes' as unknown as boolean },
    });
    const svc = new FeatureFlagService(
      makeConfig({ HERMES_AUTO_LINK: 'true' }),
      prisma,
    );
    svc.refresh();
    // 'yes' is not a boolean in the JSON map → falls back to global true
    expect(await svc.isEnabled('HERMES_AUTO_LINK', 't1')).toBe(true);
  });

  it('handles missing settings.featureFlags gracefully', async () => {
    const prisma = makePrisma({}); // no featureFlags key
    const svc = new FeatureFlagService(
      makeConfig({ HERMES_AUTO_LINK: 'true' }),
      prisma,
    );
    svc.refresh();
    expect(await svc.isEnabled('HERMES_AUTO_LINK', 't1')).toBe(true);
  });

  it('backward-compat: tenant overrides stored under retired HERMES_ENABLED are still read', async () => {
    // Tenants that had HERMES_ENABLED set before Phase H have rows in
    // Tenant.settings.featureFlags.HERMES_ENABLED. The service should still
    // read them (for audit/cleanup) but return false globally since the flag
    // is unknown. Per-tenant override wins → returns the stored value.
    const prisma = makePrisma({
      featureFlags: { HERMES_ENABLED: true },
    });
    const svc = new FeatureFlagService(makeConfig({}), prisma);
    svc.refresh();
    // Per-tenant override is honored (returns true from stored data).
    expect(await svc.isEnabled('HERMES_ENABLED', 't1')).toBe(true);
  });
});
