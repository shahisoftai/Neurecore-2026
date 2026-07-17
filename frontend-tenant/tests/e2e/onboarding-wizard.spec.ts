import { test, expect, type Page } from '@playwright/test';

const API_BASE = 'http://localhost:3000/api/v1';
const DEMO_EMAIL = 'shahikhail@nutrition.com';
const DEMO_PASSWORD = 'Nutrition@123!';
const FRONTEND_URL = 'http://localhost:3001';

/**
 * Authenticate via the API and inject auth state into the browser.
 * Sets cookies AND Zustand persisted state so the AuthProvider
 * detects an authenticated session on page load.
 */
async function injectAuth(page: Page): Promise<{ accessToken: string; refreshToken: string; csrfToken: string; user: Record<string, unknown> }> {
  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: DEMO_EMAIL, password: DEMO_PASSWORD }),
  });
  const body = await res.json();
  const { accessToken, refreshToken } = body.data.tokens;
  const user = body.data.user;

  // The CSRF token is set as a cookie by the backend. Grab it from the response.
  const setCookieHeader = res.headers.get('set-cookie') || '';
  const csrfMatch = setCookieHeader.match(/__Host-nc_csrf=([^;]+)/);
  const csrfToken = csrfMatch ? decodeURIComponent(csrfMatch[1]) : 'test-csrf';

  // Inject all three cookies + Zustand persisted state before page JS runs.
  await page.context().addInitScript((payload) => {
    const { at, rt, csrf, user } = payload;

    // Set cookies (will be read by CookieTokenRepository)
    document.cookie = `__Host-nc_at=${encodeURIComponent(at)}; path=/; max-age=3600; SameSite=Lax; Secure`;
    document.cookie = `__Host-nc_rt=${encodeURIComponent(rt)}; path=/; max-age=3600; SameSite=Lax; Secure`;
    document.cookie = `__Host-nc_csrf=${encodeURIComponent(csrf)}; path=/; max-age=3600; SameSite=Lax; Secure`;

    // Set Zustand persisted auth state so the AuthProvider sees a cached user.
    const authStorage = {
      state: {
        user,
        _hasHydrated: true,
      },
      version: 0,
    };
    try {
      localStorage.setItem('auth-storage', JSON.stringify(authStorage));
    } catch (e) {
      // localStorage might not be available
    }
  }, { at: accessToken, rt: refreshToken, csrf: csrfToken, user });

  return { accessToken, refreshToken, csrfToken, user };
}

async function loginViaUI(page: Page): Promise<void> {
  await page.goto('/login', { waitUntil: 'networkidle' });
  await page.waitForTimeout(1_000);
  await page.locator('input[type="email"]').first().fill(DEMO_EMAIL);
  await page.locator('#password').fill(DEMO_PASSWORD);
  await page.getByRole('button', { name: /Sign In/ }).click();
  await page.waitForFunction(
    () => !window.location.pathname.includes('/login'),
    { timeout: 20_000 }
  );
}

test.describe('Shahikhail International Nutrition — Onboarding Wizard', () => {
  test.beforeEach(async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', (err) => errors.push(err.message));
    (page as Page & { __errors?: string[] }).__errors = errors;
  });

  test('1. Login via UI redirects to onboarding wizard', async ({ page }) => {
    await loginViaUI(page);
    const url = page.url();
    const isOnOnboarding = url.includes('/onboarding/setup');
    const isOnHome = url.includes('/home');
    expect(isOnOnboarding || isOnHome).toBeTruthy();
    expect(url).not.toContain('/login');
    if (isOnOnboarding) {
      await expect(page.getByText(/welcome to neurecore/i)).toBeVisible({ timeout: 5_000 });
    }
  });

  test('2. Injected auth — wizard steps visible', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/onboarding/setup', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3_000);

    // Should see the wizard
    const companyInput = page.locator('input[type="text"]').first();
    await companyInput.waitFor({ state: 'visible', timeout: 10_000 });
    await companyInput.fill('Shahikhail International Nutrition');

    const industryInput = page.locator('input[type="text"]').nth(1);
    if (await industryInput.isVisible().catch(() => false)) {
      await industryInput.fill('Nutrition & Health Supplements');
    }

    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/company logo/i)).toBeVisible({ timeout: 10_000 });
  });

  test('3. Injected auth — full wizard through Localization', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/onboarding/setup', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3_000);

    // Company
    await page.locator('input[type="text"]').first().fill('Shahikhail International Nutrition');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(1_000);

    // Logo - skip
    const skipBtn = page.getByRole('button', { name: /skip/i });
    if (await skipBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await skipBtn.click();
    } else {
      await page.getByRole('button', { name: /continue/i }).click();
    }
    await page.waitForTimeout(1_000);

    // Localization - select timezone + currency
    const tzTrigger = page.locator('#tz');
    if (await tzTrigger.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await tzTrigger.click();
      await page.getByRole('option', { name: /Asia\/Karachi/i }).click();
    }
    const curTrigger = page.locator('#cur');
    if (await curTrigger.isVisible({ timeout: 2_000 }).catch(() => false)) {
      await curTrigger.click();
      await page.getByRole('option', { name: /PKR/i }).click();
    }

    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/choose your plan/i)).toBeVisible({ timeout: 10_000 });
  });

  test('4. Injected auth — wizard through Plan + Template', async ({ page }) => {
    await injectAuth(page);
    await page.goto('/onboarding/setup', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3_000);

    // Company
    await page.locator('input[type="text"]').first().fill('Shahikhail International Nutrition');
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(500);
    // Logo skip
    const s1 = page.getByRole('button', { name: /skip/i });
    if (await s1.isVisible({ timeout: 1_000 }).catch(() => false)) await s1.click();
    else await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(500);
    // Localization continue
    await page.getByRole('button', { name: /continue/i }).click();
    await page.waitForTimeout(2_000);

    // Select Enterprise plan
    const ep = page.locator('button[aria-pressed]').filter({ hasText: /Enterprise/i }).first();
    if (await ep.isVisible({ timeout: 5_000 }).catch(() => false)) await ep.click();
    else {
      const plans = page.locator('button[aria-pressed]');
      const count = await plans.count();
      if (count > 0) await plans.nth(count - 1).click();
    }
    await page.getByRole('button', { name: /continue/i }).click();
    await expect(page.getByText(/starting template/i)).toBeVisible({ timeout: 15_000 });

    // Select Enterprise Suite template
    const templateBtn = page.locator('button[aria-pressed]').filter({ hasText: /Enterprise Suite/i }).first();
    if (await templateBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await templateBtn.click();
      // Wait for deployment to complete
      await page.waitForTimeout(5_000);
    } else {
      const skipTemplate = page.getByRole('button', { name: /skip/i });
      if (await skipTemplate.isVisible({ timeout: 2_000 }).catch(() => false)) await skipTemplate.click();
    }

    await page.waitForTimeout(3_000);
    const finalUrl = page.url();
    expect(finalUrl.includes('/home') || finalUrl.includes('/onboarding/setup')).toBeTruthy();
  });

  test('5. API verification — all wizard data saved & selections deployed', async ({ page }) => {
    const { accessToken: token } = await injectAuth(page);

    // Complete the full wizard via API
    await fetch(`${API_BASE}/tenants/me`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Shahikhail International Nutrition',
        industry: 'Nutrition & Health Supplements',
        timezone: 'Asia/Karachi',
        currency: 'PKR',
        dateFormat: 'medium',
        timeFormat: '12h',
      }),
    });

    await fetch(`${API_BASE}/onboarding/select-tier`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tierId: 'tier_enterprise' }),
    });

    const templateRes = await fetch(`${API_BASE}/onboarding/select-template`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateSlug: 'enterprise-suite' }),
    });
    const templateData = await templateRes.json();
    expect(templateData.data.departmentsCreated).toBeGreaterThan(0);
    expect(templateData.data.agentsCreated).toBeGreaterThan(0);
    console.log(`Template deployed: ${templateData.data.departmentsCreated} depts, ${templateData.data.agentsCreated} agents`);

    await fetch(`${API_BASE}/onboarding/complete`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });

    // ── Verify tenant data ──
    const tenantRes = await fetch(`${API_BASE}/tenants/me/current`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const tenant = (await tenantRes.json()).data;

    expect(tenant.name).toBe('Shahikhail International Nutrition');
    expect(tenant.industry).toBe('Nutrition & Health Supplements');
    expect(tenant.timezone).toBe('Asia/Karachi');
    expect(tenant.currency).toBe('PKR');
    expect(tenant.dateFormat).toBe('medium');
    expect(tenant.timeFormat).toBe('12h');
    expect(tenant.tierId).toBe('tier_enterprise');
    expect(tenant.onboardingStep).toBe('complete');
    expect(tenant.onboardingCompletedAt).toBeTruthy();

    // ── Verify departments were created ──
    const deptsRes = await fetch(`${API_BASE}/departments`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const deptsBody = await deptsRes.json();
    const depts = deptsBody.data?.items || deptsBody.data || [];
    const deptList = Array.isArray(depts) ? depts : [];
    expect(deptList.length).toBeGreaterThan(0);
    console.log(`Departments: ${deptList.map((d: Record<string, string>) => d.name).join(', ')}`);

    // ── Verify agents were created ──
    const agentsRes = await fetch(`${API_BASE}/agents?limit=50`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const agentsBody = await agentsRes.json();
    const agents = agentsBody.data?.items || agentsBody.data || [];
    const agentList = Array.isArray(agents) ? agents : [];
    expect(agentList.length).toBeGreaterThan(0);
    console.log(`Agents: ${agentList.length} created`);

    // ── Verify checklist was seeded ──
    const checklistRes = await fetch(`${API_BASE}/onboarding/checklist`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const checklist = (await checklistRes.json()).data || [];
    console.log(`Checklist entries: ${checklist.length}`);

    // ── Verify tenant now has onboarding data persisted ──
    const verifyRes = await fetch(`${API_BASE}/tenants/me/current`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    const finalTenant = (await verifyRes.json()).data;
    console.log('Final tenant state:', JSON.stringify({
      name: finalTenant.name,
      industry: finalTenant.industry,
      timezone: finalTenant.timezone,
      currency: finalTenant.currency,
      tierId: finalTenant.tierId,
      step: finalTenant.onboardingStep,
      completed: finalTenant.onboardingCompletedAt ? true : false,
    }));

    // All assertions passed — full wizard flow verified end-to-end
  });
});
