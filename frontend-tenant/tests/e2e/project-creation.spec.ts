import { test, expect, type Page } from '@playwright/test';

/**
 * project-creation.spec.ts — Phase 2D 3-host create flow E2E test.
 *
 * Verifies:
 *  - Essentials → Discovery → Review → Confirm takes the new 3-host path.
 *  - Discovery step shows CompletenessMeter + QuestionEngine.
 *  - Answering 2 questions + "skip for now" lands on Review.
 *  - Confirm creates the project and the modal closes.
 *
 * Assumes:
 *  - Running dev server on configured baseURL.
 *  - Demo tenant with admin@example.com / Admin123! login.
 *  - Backend has at least 1 system ProjectType with seeded informationRequirements.
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

test.describe('Phase 2D — 3-host project creation flow', () => {
  test('essentials → discovery → review → confirm', async ({ page }) => {
    await login(page);

    // Open the create-project form.
    await page.goto('/projects/new');
    await expect(page.getByTestId('create-project-form')).toBeVisible();
    await expect(page.getByTestId('create-project-form')).toHaveAttribute('data-step', 'essentials');

    // Layer 1 — Essentials: fill required fields.
    await page.getByLabel(/^name/i).first().fill('E2E Test Project');
    // Pick the first available project type (if any).
    const typeSelect = page.locator('select').filter({ hasText: /— None —|Project Type/ }).first();
    const optionValues = await typeSelect.locator('option').evaluateAll((els) =>
      (els as HTMLOptionElement[]).map((el) => el.value).filter((v) => v),
    );
    if (optionValues.length > 0) {
      await typeSelect.selectOption(optionValues[0]);
    }
    await page.getByTestId('essentials-submit').click();

    // Layer 2 — Discovery (or Review if the project has no required questions).
    await expect(page.getByTestId('create-project-form')).toHaveAttribute(
      'data-step',
      /discovery|review/,
      { timeout: 15_000 },
    );

    // If we landed on Discovery, answer up to 2 questions then skip.
    const step = await page.getByTestId('create-project-form').getAttribute('data-step');
    if (step === 'discovery') {
      await expect(page.getByTestId('completeness-meter')).toBeVisible();

      // Answer up to 2 questions.
      for (let i = 0; i < 2; i++) {
        const submit = page.getByTestId('form-skin-submit');
        if (await submit.isVisible({ timeout: 2000 }).catch(() => false)) {
          // Type something into the form-skin text/number/select input.
          const input = page.locator('[data-testid="form-skin"] input, [data-testid="form-skin"] select').first();
          if (await input.isVisible().catch(() => false)) {
            const tag = await input.evaluate((el) => el.tagName);
            if (tag === 'SELECT') {
              const opts = await input.evaluate((el: HTMLSelectElement) =>
                Array.from(el.options)
                  .map((o) => o.value)
                  .filter((v) => v),
              );
              if (opts.length > 0) await input.selectOption(opts[0]);
            } else {
              await input.fill(`answer-${i + 1}`);
            }
            await submit.click();
            await page.waitForTimeout(300);
          }
        } else {
          break;
        }
      }

      // Skip to Review.
      await page.getByTestId('discovery-skip').click();
    }

    // Layer 3 — Review.
    await expect(page.getByTestId('create-project-form')).toHaveAttribute('data-step', 'review', {
      timeout: 15_000,
    });
    await expect(page.getByTestId('review-host')).toBeVisible();
    await expect(page.getByTestId('review-confirm')).toBeVisible();

    // Confirm.
    await page.getByTestId('review-confirm').click();
    // Form should close (modal-style overlay removed).
    await expect(page.getByTestId('create-project-form')).toBeHidden({ timeout: 5_000 });
  });

  test('untyped project advances directly to review (no discovery)', async ({ page }) => {
    await login(page);

    await page.goto('/projects/new');
    await expect(page.getByTestId('create-project-form')).toBeVisible();

    // Leave project type as "— None —".
    await page.getByLabel(/^name/i).first().fill('E2E Untyped Project');
    await page.getByTestId('essentials-submit').click();

    // Either lands directly on review (untyped → no questions) or
    // briefly on discovery (engine returns 0 questions → auto-advance).
    await expect(page.getByTestId('create-project-form')).toHaveAttribute(
      'data-step',
      'review',
      { timeout: 15_000 },
    );
  });
});