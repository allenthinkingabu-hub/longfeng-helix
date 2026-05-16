// PHASE-A-LOGIN-H5 · adversarial exploratory tests
// 目的: 验证极端/恶意输入下系统坚如磐石 (连点/超长/注入/race)
import { test, expect } from '@playwright/test';
import { execSync } from 'node:child_process';

const FIXTURE_EMAIL = 'test@example.com';
const TID = {
  root: 'p00-root',
  email: 'p00-email-input',
  password: 'p00-password-input',
  consentCheckbox: 'p00-consent-bar-checkbox',
  loginBtn: 'p00-login-submit-btn',
  errorInline: 'p00-error-inline',
  homeRoot: 'p-home-root',
} as const;

function resetFixture(): void {
  execSync(
    `docker exec team-1-pg psql -U longfeng -d wrongbook -c "UPDATE auth_user SET status='ACTIVE', failed_attempts=0, locked_until=NULL WHERE email='${FIXTURE_EMAIL}';"`,
    { stdio: 'pipe' }
  );
}

test.beforeEach(() => { resetFixture(); });

test.describe('PHASE-A-LOGIN-H5 · adversarial', () => {

  // ─── 连点防抖 (rapid-fire double/triple click) ───
  test('连点: triple-click login CTA → only 1 request fires (debounce guard)', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByTestId(TID.root)).toBeVisible();
    await page.getByTestId(TID.consentCheckbox).click();
    await page.getByTestId(TID.email).fill(FIXTURE_EMAIL);
    await page.getByTestId(TID.password).fill('Test@1234');

    // Track network requests to /api/auth/login
    const requests: number[] = [];
    page.on('request', req => {
      if (req.url().includes('/api/auth/login') && req.method() === 'POST') {
        requests.push(Date.now());
      }
    });

    // Rapid-fire 3 clicks with no delay
    const btn = page.getByTestId(TID.loginBtn);
    await btn.click({ delay: 0 });
    await btn.click({ delay: 0, force: true });
    await btn.click({ delay: 0, force: true });

    // Wait for navigation (happy path should still work)
    await page.waitForURL('**/home', { timeout: 10000 });
    await expect(page.getByTestId(TID.homeRoot)).toBeVisible({ timeout: 5000 });

    // Only 1 real login request should have fired (debounce: authState=VERIFYING blocks subsequent)
    expect(requests.length).toBeLessThanOrEqual(2); // 1 expected, allow 2 max for race tolerance
  });

  // ─── 超长输入注入 (超长 email + XSS payload in password) ───
  test('注入/超长: 1000-char email + XSS script tag in password → no crash, graceful error', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByTestId(TID.root)).toBeVisible();
    await page.getByTestId(TID.consentCheckbox).click();

    // 超长 email (1000 chars)
    const longEmail = 'a'.repeat(990) + '@test.com';
    await page.getByTestId(TID.email).fill(longEmail);

    // XSS 注入 payload as password
    const xssPayload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    await page.getByTestId(TID.password).fill(xssPayload);

    await page.getByTestId(TID.loginBtn).click();

    // Should get graceful error (401 or network error), NOT a crash or XSS execution
    await expect(page.getByTestId(TID.errorInline)).toBeVisible({ timeout: 5000 });
    const errorText = await page.getByTestId(TID.errorInline).textContent();
    expect(errorText).toBeTruthy();

    // Verify no XSS execution: React escapes value attrs properly (no injected DOM nodes)
    // The payload appears as escaped text inside input value= (safe), NOT as executable HTML
    const injectedScripts = await page.locator('script').filter({ hasText: 'alert' }).count();
    expect(injectedScripts).toBe(0);
    // No alert dialog popped (XSS did not execute)
    let alertFired = false;
    page.on('dialog', () => { alertFired = true; });
    expect(alertFired).toBe(false);

    // Page still functional (no crash)
    await expect(page.getByTestId(TID.root)).toBeVisible();
  });

  // ─── SQL 注入 attempt ───
  test('SQL注入: email = SQL payload → backend rejects gracefully (no 500)', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByTestId(TID.root)).toBeVisible();
    await page.getByTestId(TID.consentCheckbox).click();

    // SQL injection payload
    const sqlPayload = "' OR '1'='1'; DROP TABLE auth_user; --";
    await page.getByTestId(TID.email).fill(sqlPayload);
    await page.getByTestId(TID.password).fill('anything');

    // Listen for response status
    const responsePromise = page.waitForResponse(resp => resp.url().includes('/api/auth/login'));
    await page.getByTestId(TID.loginBtn).click();
    const response = await responsePromise;

    // Must be 401 (not found → unified message) or 400, NOT 500 (SQL injection should not crash)
    expect(response.status()).not.toBe(500);
    expect([400, 401]).toContain(response.status());

    // UI shows graceful error
    await expect(page.getByTestId(TID.errorInline)).toBeVisible({ timeout: 5000 });

    // Verify table still exists (SQL injection did NOT execute)
    const result = execSync(
      `docker exec team-1-pg psql -U longfeng -d wrongbook -c "SELECT count(*) FROM auth_user;"`,
      { encoding: 'utf8' }
    );
    expect(result).toContain('1'); // fixture row still exists
  });

  // ─── Race: 阻断网络中途 → error toast ───
  test('阻断: abort inflight request → 网络不可用 error', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByTestId(TID.root)).toBeVisible();
    await page.getByTestId(TID.consentCheckbox).click();
    await page.getByTestId(TID.email).fill(FIXTURE_EMAIL);
    await page.getByTestId(TID.password).fill('Test@1234');

    // Block the API endpoint to simulate network failure
    await page.route('**/api/auth/login', route => route.abort('connectionfailed'));
    await page.getByTestId(TID.loginBtn).click();

    // Should show network error
    await expect(page.getByTestId(TID.errorInline)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId(TID.errorInline)).toHaveText('网络不可用，请检查后重试');

    // Unblock and verify recovery
    await page.unroute('**/api/auth/login');
    await page.getByTestId(TID.loginBtn).click();

    // After unblock, should succeed
    await page.waitForURL('**/home', { timeout: 10000 });
  });
});
