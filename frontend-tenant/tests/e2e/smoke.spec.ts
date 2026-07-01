import { test, expect, type Page } from '@playwright/test';

/**
 * Smoke tests for the redesigned tenant frontend (Phase 12).
 *
 * These tests assume:
 *   - A running dev server (pnpm dev) on the configured baseURL
 *   - Demo tenant with admin@example.com / Admin123! login
 *   - Phase 1 backend changes deployed (spawn endpoint, archive endpoint, costs fix, etc.)
 *
 * Tests focus on:
 *   1. Login flow
 *   2. Each new route renders without console errors
 *   3. Tab switching preserves URL state
 *   4. Theme toggling works
 *   5. Old routes redirect to new ones
 */

const DEMO_EMAIL = process.env.TEST_EMAIL ?? 'admin@example.com';
const DEMO_PASSWORD = process.env.TEST_PASSWORD ?? 'Admin123!';

async function login(page: Page): Promise<void> {
  await page.goto('/login');
  await page.getByLabel(/email/i).fill(DEMO_EMAIL);
  await page.getByLabel(/password/i).fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.waitForURL((url) => !url.pathname.startsWith('/login'), { timeout: 15_000 });
}

test.describe('Phase 12 smoke tests', () => {
  test.beforeEach(async ({ page }) => {
    // Capture console errors during the test
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));

    // Store errors on page for later assertion
    (page as Page & { __errors?: string[] }).__errors = errors;
  });

  test('login flow → command-center', async ({ page }) => {
    await login(page);
    await expect(page).toHaveURL(/\/command-center/);
    await expect(page.getByRole('heading', { name: /command center/i })).toBeVisible();
  });

  test('command-center page renders with hero + KPI + dept cards', async ({ page }) => {
    await login(page);
    await page.goto('/command-center');
    await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/active agents/i)).toBeVisible();
  });

  test('marketplace tabs render', async ({ page }) => {
    await login(page);
    await page.goto('/marketplace?tab=agents');
    await expect(page.getByRole('heading', { name: /marketplace/i })).toBeVisible();
    await page.click('text=Agent Templates');
    await expect(page).toHaveURL(/tab=templates/);
  });

  test('departments page has all 3 tabs', async ({ page }) => {
    await login(page);
    await page.goto('/departments');
    await expect(page.getByRole('heading', { name: /departments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /departments/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /org chart/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /templates/i })).toBeVisible();
  });

  test('service-desk page has 4 tabs', async ({ page }) => {
    await login(page);
    await page.goto('/service-desk');
    await expect(page.getByRole('heading', { name: /service desk/i })).toBeVisible();
    for (const label of ['Inbox', 'Approvals', 'Audit Log', 'Activity']) {
      await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
    }
  });

  test('intelligence page has 6 tabs', async ({ page }) => {
    await login(page);
    await page.goto('/intelligence');
    await expect(page.getByRole('heading', { name: /intelligence/i })).toBeVisible();
    for (const label of ['Analytics', 'Observability', 'Health', 'Reliability', 'Security', 'Settings']) {
      await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
    }
  });

  test('finance page has 5 tabs', async ({ page }) => {
    await login(page);
    await page.goto('/finance');
    await expect(page.getByRole('heading', { name: /finance/i })).toBeVisible();
    for (const label of ['Overview', 'Invoices', 'Expenses', 'Budgets', 'Billing']) {
      await expect(page.getByRole('button', { name: new RegExp(label, 'i') })).toBeVisible();
    }
  });

  test('old /dashboard redirects to /command-center via Next.js rewrite', async ({ page }) => {
    await login(page);
    await page.goto('/dashboard');
    // The rewrite turns /dashboard into /command-center
    await expect(page).toHaveURL(/\/command-center/);
  });

  test('theme cycle button works', async ({ page }) => {
    await login(page);
    await page.goto('/command-center');
    const themeButton = page.locator('[aria-label="Toggle theme"]');
    await expect(themeButton).toBeVisible();
    await themeButton.click();
    // After click, html should have a different theme class
    const html = page.locator('html');
    const classBefore = (await html.getAttribute('class')) ?? '';
    await themeButton.click();
    const classAfter = (await html.getAttribute('class')) ?? '';
    expect(classBefore).not.toBe(classAfter);
  });

  test('command palette opens on ⌘K', async ({ page }) => {
    await login(page);
    await page.goto('/command-center');
    await page.keyboard.press('Control+K');
    // The palette should appear — check for the input placeholder
    await expect(page.getByPlaceholder(/search|command/i).first()).toBeVisible({ timeout: 5_000 });
  });

  test('no console errors on any new route', async ({ page }) => {
    const errors = (page as Page & { __errors?: string[] }).__errors ?? [];
    await login(page);
    const routes = [
      '/command-center',
      '/marketplace',
      '/marketplace?tab=templates',
      '/marketplace?tab=connectors',
      '/departments',
      '/departments?tab=org-chart',
      '/departments?tab=templates',
      '/service-desk',
      '/service-desk?tab=approvals',
      '/service-desk?tab=audit',
      '/service-desk?tab=activity',
      '/intelligence',
      '/intelligence?tab=observability',
      '/intelligence?tab=health',
      '/intelligence?tab=reliability',
      '/intelligence?tab=security',
      '/intelligence?tab=settings',
      '/finance',
      '/finance?tab=invoices',
      '/finance?tab=expenses',
      '/finance?tab=budgets',
      '/finance?tab=billing',
    ];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(500); // settle
    }

    // Filter out expected/benign errors
    const critical = errors.filter((e) =>
      !e.includes('favicon') &&
      !e.includes('Failed to load resource') &&
      !e.includes('socket') &&
      !e.toLowerCase().includes('hydration warning')
    );
    expect(critical).toEqual([]);
  });

  test('mobile viewport (375×812) renders command-center', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.goto('/command-center');
    await expect(page.getByText(/Good (morning|afternoon|evening)/i)).toBeVisible();
  });

  test('mobile viewport renders marketplace without overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await login(page);
    await page.goto('/marketplace');
    await expect(page.getByRole('heading', { name: /marketplace/i })).toBeVisible();
    // No horizontal scroll
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });
});