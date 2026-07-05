/**
 * FeatureFlagService unit tests — H9 (feature flag wiring).
 *
 * Covers:
 *  - global default behaviour (env-driven)
 *  - per-tenant overrides from `Tenant.settings.featureFlags`
 *  - per-tenant wins over global
 *  - unknown flags fail-closed
 *  - cache invalidation on `invalidateTenantOverrides`
 *  - knownFlags() returns the registered set
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
  it('reads HERMES_ENABLED from env', () => {
    const svc = new FeatureFlagService(makeConfig({ HERMES_ENABLED: 'true' }));
    svc.refresh();
    expect(svc.isEnabled('HERMES_ENABLED')).toBe(true);
    expect(svc.isEnabled('HERMES_AUTO_LINK')).toBe(false);
  });

  it('unknown flags fail-closed', () => {
    const svc = new FeatureFlagService(makeConfig({}));
    svc.refresh();
    expect(svc.isEnabled('UNKNOWN_FLAG')).toBe(false);
    expect(svc.isDisabled('UNKNOWN_FLAG')).toBe(true);
  });

  it('refresh() picks up env changes', () => {
    const cfg = makeConfig({ HERMES_ENABLED: 'false' });
    const svc = new FeatureFlagService(cfg);
    svc.refresh();
    expect(svc.isEnabled('HERMES_ENABLED')).toBe(false);
    (cfg.get as jest.Mock).mockImplementation((k: string) =>
      k === 'HERMES_ENABLED' ? 'true' : undefined,
    );
    svc.refresh();
    expect(svc.isEnabled('HERMES_ENABLED')).toBe(true);
  });

  it('knownFlags() returns the registered set', () => {
    const svc = new FeatureFlagService(makeConfig({}));
    svc.refresh();
    const names = svc.knownFlags();
    expect(names).toEqual(
      expect.arrayContaining([
        'DISABLE_AI_ACTIONS',
        'HERMES_ENABLED',
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
      makeConfig({ HERMES_ENABLED: 'true' }),
      prisma,
    );
    svc.refresh();
    expect(await svc.isEnabled('HERMES_ENABLED', 't1')).toBe(true);
  });

  it('per-tenant override wins over global default', async () => {
    const prisma = makePrisma({
      featureFlags: { HERMES_ENABLED: false },
    });
    const svc = new FeatureFlagService(
      makeConfig({ HERMES_ENABLED: 'true' }),
      prisma,
    );
    svc.refresh();
    expect(await svc.isEnabled('HERMES_ENABLED', 't1')).toBe(false);
    expect(await svc.isDisabled('HERMES_ENABLED', 't1')).toBe(true);
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
      featureFlags: { HERMES_ENABLED: true },
    });
    const svc = new FeatureFlagService(makeConfig({}), prisma);
    svc.refresh();
    await svc.isEnabled('HERMES_ENABLED', 't1');
    await svc.isEnabled('HERMES_ENABLED', 't1');
    // Only one DB read for the same tenant.
    expect(prisma.tenant.findUnique as jest.Mock).toHaveBeenCalledTimes(1);
  });

  it('invalidateTenantOverrides forces a re-read', async () => {
    const prisma = makePrisma({ featureFlags: { HERMES_ENABLED: true } });
    const svc = new FeatureFlagService(makeConfig({}), prisma);
    svc.refresh();
    await svc.isEnabled('HERMES_ENABLED', 't1');
    svc.invalidateTenantOverrides('t1');
    await svc.isEnabled('HERMES_ENABLED', 't1');
    expect(prisma.tenant.findUnique as jest.Mock).toHaveBeenCalledTimes(2);
  });

  it('ignores non-boolean values in tenant.settings.featureFlags', async () => {
    const prisma = makePrisma({
      featureFlags: { HERMES_ENABLED: 'yes' as unknown as boolean },
    });
    const svc = new FeatureFlagService(
      makeConfig({ HERMES_ENABLED: 'true' }),
      prisma,
    );
    svc.refresh();
    // 'yes' is not a boolean in the JSON map → falls back to global true
    expect(await svc.isEnabled('HERMES_ENABLED', 't1')).toBe(true);
  });

  it('handles missing settings.featureFlags gracefully', async () => {
    const prisma = makePrisma({}); // no featureFlags key
    const svc = new FeatureFlagService(
      makeConfig({ HERMES_ENABLED: 'true' }),
      prisma,
    );
    svc.refresh();
    expect(await svc.isEnabled('HERMES_ENABLED', 't1')).toBe(true);
  });
});