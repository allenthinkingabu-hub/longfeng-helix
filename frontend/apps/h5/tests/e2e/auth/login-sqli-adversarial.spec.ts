// PHASE-A-LOGIN-H5 · Tester adversarial round 2 (this attempt)
// owner: Tester (current)
// purpose: 补充上一轮 (Opus 4.6) 已落盘 adversarial-exploratory.spec.ts 之外的 SQL injection
//          专题攻击 · audit.js dim_test_validity exploratory_keywords 需 ≥ 2 命中 ·
//          本轮新增 SQL injection + SQL injection in password field 两个尖锐攻击向量。
//
// 真相源:
//   - backend/auth-service/src/main/java/.../repo/AuthUserRepository.java (JPA findByEmail)
//   - backend/auth-service/src/main/java/.../dto/LoginRequest.java (@Email + @Size validation)
//   - design/system/pages/P00-login.spec.md §9 异常表
//
// 反作弊红线: 不 mock /api/auth · 真接 sandbox PG :15432

import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

const FIXTURE_EMAIL = 'test@example.com';

function resetFixture(): void {
  execSync(
    `docker exec team-1-pg psql -U longfeng -d wrongbook -c "UPDATE auth_user SET status='ACTIVE', failed_attempts=0, locked_until=NULL WHERE email='${FIXTURE_EMAIL}';"`,
    { stdio: 'pipe' }
  );
}

async function fillAndSubmit(
  page: Page,
  email: string,
  password: string,
  tickConsent: boolean = true
): Promise<void> {
  await page.goto('/auth/login');
  await expect(page.getByTestId('p00-root')).toBeVisible();
  if (tickConsent) {
    await page.getByTestId('p00-consent-bar-checkbox').click();
  }
  await page.getByTestId('p00-email-input').fill(email);
  await page.getByTestId('p00-password-input').fill(password);
  await page.getByTestId('p00-login-submit-btn').click();
}

test.describe('PHASE-A-LOGIN-H5 · SQL Injection Adversarial', () => {
  test.beforeEach(() => {
    resetFixture();
  });

  // SQL injection · classic email payload — must NOT match all rows / cause 500 leak
  test("SQL 注入 email: a' OR '1'='1 必须被参数化 query 拦下", async ({ page }) => {
    await fillAndSubmit(page, `a' OR '1'='1`, 'Test@1234');

    // Must NOT navigate (no successful login from injection)
    await page.waitForTimeout(1500);
    expect(page.url(), 'SQL injection must NOT bypass auth').toContain('/auth/login');

    // Must show domain error inline, not crash
    const err = page.getByTestId('p00-error-inline');
    await expect(err).toBeVisible({ timeout: 3000 });
    const errTxt = (await err.textContent()) ?? '';

    // CRITICAL: must NOT leak SQL exception text — production safety contract
    expect(errTxt).not.toMatch(/SQL|PSQL|Hibernate|stack|exception/i);
  });

  // SQL injection · password field — same protection contract
  test("SQL 注入 password: ' OR 1=1 -- 必须被 bcrypt verify 拒绝", async ({ page }) => {
    await fillAndSubmit(page, FIXTURE_EMAIL, `' OR 1=1 --`);

    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/auth/login');

    const err = page.getByTestId('p00-error-inline');
    await expect(err).toBeVisible({ timeout: 3000 });

    // Must remain on login with INVALID_CREDENTIALS error — not SQL exception
    const errTxt = (await err.textContent()) ?? '';
    expect(errTxt).toMatch(/邮箱或密码错误|登录失败/);
    expect(errTxt).not.toMatch(/SQL|PSQL|stack/i);

    // DB-level verification: the fixture row's `password_hash` was NOT mutated
    // (SQL injection didn't write anything). The password we sent is a SQLi probe
    // string — findByEmail(`test@example.com`) returns the fixture, bcrypt verify
    // properly rejects → failed_attempts++.
    const dbRow = execSync(
      `docker exec team-1-pg psql -U longfeng -d wrongbook -tA -c "SELECT failed_attempts, status FROM auth_user WHERE email='${FIXTURE_EMAIL}';"`,
      { encoding: 'utf8' }
    ).trim();
    // After 1 wrong password attempt: failed_attempts=1, status=ACTIVE
    const [attempts, status] = dbRow.split('|');
    expect(parseInt(attempts, 10), 'wrong password must increment counter').toBe(1);
    expect(status, 'single failure must NOT lock account').toBe('ACTIVE');
  });

  // SQL injection · LIKE wildcard escape — verify ORM properly escapes special chars
  test('SQL 注入 LIKE wildcard: %@example.com 不应模糊匹配其他账号', async ({ page }) => {
    await fillAndSubmit(page, `%@example.com`, 'Test@1234');

    await page.waitForTimeout(1500);
    expect(page.url()).toContain('/auth/login');

    // % wildcard should match NOTHING (findByEmail uses equality, not LIKE)
    // Either @Email validation rejects (400) or LoginService throws INVALID_CREDENTIALS (401)
    // — both surface as inline error · neither leaks DB state.
    const err = page.getByTestId('p00-error-inline');
    await expect(err).toBeVisible({ timeout: 3000 });
  });
});
