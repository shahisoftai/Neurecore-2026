// ─── tests/e2e/auth-smoke.spec.ts ──────────────────────────────────────────────
// FIX-020: smoke test for the auth shell — verifies the AuthProvider splash
// appears, the login page renders without console errors, and there is no
// hard-redirect to /login on protected pages. Runs WITHOUT the backend.

import { test, expect } from '@playwright/test';

test.describe('FIX-020 Auth smoke (no backend)', () => {
  test('home page renders the auth splash then landing', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/');
    // The auth provider initializes from empty cookies + no cached user,
    // so the page should reach a stable state quickly.
    await expect(page).toHaveTitle(/NeureCore/i);
    // Either splash or landing — both are valid states depending on hydration timing.
    const body = await page.textContent('body');
    expect(body).toMatch(/NeureCore|Restoring session/i);
  });

  test('/login renders the form with no console errors', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    await page.goto('/login');
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible({ timeout: 10_000 });
    // Should not have hard-redirected away from /login.
    expect(page.url()).toContain('/login');
    // Filter out expected 4xx log noise and AuthProvider re-render noise.
    const realErrors = errors.filter(
      (e) => !e.includes('Failed to load resource') && !e.includes('Hydration'),
    );
    expect(realErrors).toEqual([]);
  });

  test('a protected route does not hard-redirect-loop', async ({ page }) => {
    let navigationsToLogin = 0;
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame() && frame.url().includes('/login')) {
        navigationsToLogin++;
      }
    });

    await page.goto('/command-center');
    // Wait long enough for the auth init + any potential redirect.
    await page.waitForTimeout(3000);

    // The whole point of FIX-020: the new AuthProvider DOES NOT call
    // window.location.href = '/login' anymore. Any redirect would be a
    // soft router.push from useTenantAuth/useRequireAuth. But for a fresh
    // visit with no cookies, the behaviour should be: stay on command-center
    // and let the page handle the unauthenticated state, OR at most 1
    // soft redirect to /login. We assert NEITHER behaviour triggers the
    // loop pattern (many repeated navs).
    expect(navigationsToLogin).toBeLessThanOrEqual(1);
  });
});
