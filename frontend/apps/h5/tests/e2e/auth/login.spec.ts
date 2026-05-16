// trace: biz=biz/业务与技术解决方案_AI错题本_基于日历系统.md §2A.3.1 (P00 决策树) + §2B.13 SC-12 F07
//        spec=design/system/pages/P00-login.spec.md §5 API 触点 + §6 状态机 + §9 异常表
//        code=backend/auth-service/src/main/java/com/longfeng/authservice/controller/AuthController.java
//        code=frontend/apps/h5/src/pages/Auth/Login.tsx
//
// PHASE-A-LOGIN-H5 · P00 login (h5 端) · 4 testcase per inflight scope_in #14
//
// 业务剧本 (source of truth · biz §2A.3.1 决策树节点 4 未命中 → P-LANDING → 选 "已有账号 → 登录" → P00):
//   学生在 P00 (a) 输入正确凭据 → /home  (b) 输入错密码 → 行内 error
//   (c) 输入不存在邮箱 → 同上 error  (d) 同 email 连续 5 次错密码 → "账号已锁定" 文案
//
// 测试环境前置:
//   - vite dev server :5174 (pnpm -F h5 dev) — 经 /api/auth proxy → auth-service :8091
//   - auth-service :8091 (mvn -pl auth-service spring-boot:run)
//   - PG :15432 含 auth_user 测试夹具 (test@example.com / Test@1234 bcrypt)
//   - Redis :16379 用于 refresh token 存储
//
// 反作弊红线:
//   - 这是真实后端 E2E · 不 mock /api/auth/login
//   - 每个 testcase 之前 reset 后端 auth_user 状态 (UPDATE failed_attempts=0, status='ACTIVE')

import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

const FIXTURE_EMAIL = 'test@example.com';
const FIXTURE_PASSWORD = 'Test@1234';

const TID = {
  root: 'p00-root',
  email: 'p00-email-input',
  password: 'p00-password-input',
  rememberMe: 'p00-remember-me',
  consentCheckbox: 'p00-consent-bar-checkbox',
  loginBtn: 'p00-login-submit-btn',
  errorInline: 'p00-error-inline',
  homeRoot: 'p-home-root',
} as const;

/** Reset the fixture row on the sandbox PG between tests. Real DB, real reset. */
function resetFixture(): void {
  execSync(
    `docker exec team-1-pg psql -U longfeng -d wrongbook -c "UPDATE auth_user SET status='ACTIVE', failed_attempts=0, locked_until=NULL WHERE email='${FIXTURE_EMAIL}';"`,
    { stdio: 'pipe' }
  );
}

async function tickConsent(page: Page): Promise<void> {
  // Click the inline checkbox in the consent bar; needs to flip canSubmit on the submit button.
  const checkbox = page.getByTestId(TID.consentCheckbox);
  await checkbox.click();
}

async function gotoLogin(page: Page, query: string = ''): Promise<void> {
  await page.goto(`/auth/login${query}`);
  await expect(page.getByTestId(TID.root)).toBeVisible();
}

test.describe('PHASE-A-LOGIN-H5 · P00 login (4 cases)', () => {
  test.beforeEach(() => {
    resetFixture();
  });

  // ───────────────── (a) happy ─────────────────
  test('PHASE-A-LOGIN-H5 happy: test@example.com + Test@1234 → /home', async ({ page }) => {
    await gotoLogin(page);
    await tickConsent(page);
    await page.getByTestId(TID.email).fill(FIXTURE_EMAIL);
    await page.getByTestId(TID.password).fill(FIXTURE_PASSWORD);
    await page.getByTestId(TID.loginBtn).click();

    // SUCCESS → router.replace('/home' default per inflight scope_in #10) · 期望看到 p-home-root
    // (`/` and `/home` are both mounted to HomePage per src/App.tsx)
    await page.waitForURL('**/home', { timeout: 10000 });
    await expect(page.getByTestId(TID.homeRoot)).toBeVisible({ timeout: 10000 });

    // jwt persisted to localStorage
    const jwt = await page.evaluate(() => window.localStorage.getItem('jwt'));
    expect(jwt).toBeTruthy();
    expect(jwt!.split('.').length).toBe(3); // header.payload.signature
  });

  // ───────────────── (b) wrong_password ─────────────────
  test('PHASE-A-LOGIN-H5 wrong_password → inline 邮箱或密码错误', async ({ page }) => {
    await gotoLogin(page);
    await tickConsent(page);
    await page.getByTestId(TID.email).fill(FIXTURE_EMAIL);
    await page.getByTestId(TID.password).fill('wrongPass!1');
    await page.getByTestId(TID.loginBtn).click();

    await expect(page.getByTestId(TID.errorInline)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId(TID.errorInline)).toHaveText('邮箱或密码错误');
    // URL unchanged (still on /auth/login)
    expect(page.url()).toContain('/auth/login');
  });

  // ───────────────── (c) wrong_email (unified message) ─────────────────
  test('PHASE-A-LOGIN-H5 wrong_email → same 邮箱或密码错误 (prevent enumeration)', async ({ page }) => {
    await gotoLogin(page);
    await tickConsent(page);
    await page.getByTestId(TID.email).fill(`ghost-${Date.now()}@example.com`);
    await page.getByTestId(TID.password).fill('anything!1');
    await page.getByTestId(TID.loginBtn).click();

    await expect(page.getByTestId(TID.errorInline)).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId(TID.errorInline)).toHaveText('邮箱或密码错误');
  });

  // ───────────────── (d) 5-strike lockout ─────────────────
  test('PHASE-A-LOGIN-H5 lockout: 5 connectives wrong → 账号已锁定 · 5 分钟后重试', async ({ page }) => {
    await gotoLogin(page);
    await tickConsent(page);

    // 4 wrong attempts → 邮箱或密码错误
    for (let i = 1; i <= 4; i++) {
      await page.getByTestId(TID.email).fill(FIXTURE_EMAIL);
      await page.getByTestId(TID.password).fill(`wrongPass!${i}`);
      await page.getByTestId(TID.loginBtn).click();
      await expect(page.getByTestId(TID.errorInline)).toHaveText('邮箱或密码错误', {
        timeout: 5000,
      });
    }

    // 5th attempt → lockout message
    await page.getByTestId(TID.password).fill('wrongPass!5');
    await page.getByTestId(TID.loginBtn).click();
    await expect(page.getByTestId(TID.errorInline)).toHaveText('账号已锁定 · 5 分钟后重试', {
      timeout: 5000,
    });

    // 6th attempt with CORRECT password — still locked
    await page.getByTestId(TID.password).fill(FIXTURE_PASSWORD);
    await page.getByTestId(TID.loginBtn).click();
    await expect(page.getByTestId(TID.errorInline)).toHaveText('账号已锁定 · 5 分钟后重试', {
      timeout: 5000,
    });
  });
});
