import { test, expect, type Page } from '@playwright/test';

/**
 * Chat e2e tests for the admin frontend (Phase 7.4, 2026-07-20).
 * Mirrors the tenant frontend's chat.spec.ts so both frontends share the same
 * data-testid contract for the chat panel.
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

test.describe('Admin chat panel e2e (Phase 7.4)', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    (page as Page & { __errors?: string[] }).__errors = errors;
  });

  test('chat trigger button opens the panel', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /toggle conversation panel/i }).click();
    await expect(page.getByTestId('chat-panel')).toBeVisible({ timeout: 5_000 });
  });

  test('user message and assistant reply flow', async ({ page }) => {
    await login(page);
    await page.getByRole('button', { name: /toggle conversation panel/i }).click();
    await expect(page.getByTestId('chat-panel')).toBeVisible();

    const textarea = page.getByTestId('chat-input');
    await textarea.fill('Hello');
    await page.getByTestId('chat-submit').click();

    await expect(page.getByTestId('chat-message-user').last()).toBeVisible({ timeout: 5_000 });
    await expect(page.getByTestId('chat-message-assistant').last()).toBeVisible({
      timeout: 60_000,
    });

    const assistantText = await page.getByTestId('chat-message-assistant').last().textContent();
    expect(assistantText).toBeTruthy();
    expect(assistantText!.length).toBeGreaterThan(2);

    const errors = (page as Page & { __errors?: string[] }).__errors ?? [];
    expect(errors).toEqual([]);
  });
});
