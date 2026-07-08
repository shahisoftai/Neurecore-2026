// ─── tests/e2e/prod-auth-smoke.spec.ts ─────────────────────────────────────────
// Browser-level smoke against the live prod deployment.
// Asserts the new AuthService handles real cookies correctly.

import { test, expect } from '@playwright/test';

const TENANT_BASE = process.env.TENANT_BASE ?? 'https://hq.neurecore.com';
const ADMIN_BASE  = process.env.ADMIN_BASE  ?? 'https://cc.neurecore.com';

test.describe('Live prod smoke (FIX-020)', () => {
  test('tenant /login renders without errors (no cookies)', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${TENANT_BASE}/login`);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/login');
    expect(errors.filter(e => !e.includes('Failed to load resource') && !e.includes('Hydration'))).toEqual([]);
  });

  test('admin /admin/login renders without errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto(`${ADMIN_BASE}/admin/login`);
    await expect(page.getByRole('heading', { name: /admin portal/i })).toBeVisible({ timeout: 15_000 });
    expect(page.url()).toContain('/login');
    expect(errors.filter(e => !e.includes('Failed to load resource') && !e.includes('Hydration'))).toEqual([]);
  });

  test('tenant protected route does not hard-redirect-loop on missing cookies', async ({ page }) => {
    let navigationsToLogin = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('/login')) navigationsToLogin++;
    });

    await page.goto(`${TENANT_BASE}/command-center`);
    await page.waitForTimeout(4000); // give useTenantAuth time to react

    // Behaviour: useTenantAuth redirects ONCE if no user (expected, soft router.replace).
    // The old buggy behaviour was: redirect to /login via window.location.href (hard nav, full reload).
    expect(navigationsToLogin).toBeLessThanOrEqual(1);
  });

  test('admin protected route does not hard-redirect-loop on missing cookies', async ({ page }) => {
    let navigationsToLogin = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('/login')) navigationsToLogin++;
    });

    await page.goto(`${ADMIN_BASE}/admin/overview`);
    await page.waitForTimeout(4000);

    expect(navigationsToLogin).toBeLessThanOrEqual(1);
  });
});
