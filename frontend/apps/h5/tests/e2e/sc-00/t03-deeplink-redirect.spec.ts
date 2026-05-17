// ============================================================================
// SC-00-T03 · P00 deeplink redirect roundtrip · Playwright E2E (5 testcase)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.1 决策树节点 3 (verdict=LOGIN · 回 P00 · ?redirect=<encoded>)
//   biz §2B.1a 步 3'-5' (P00 redirect 接收 + login 成功跳目标)
//   biz §2B.1a 关键断言点第 3 条 (JWT 过期 redirect_to 不丢失用户意图)
//   design/system/pages/P00-login.spec.md §7.1 (whitelist) §9 (open-redirect 降级)
//   frontend/apps/h5/src/pages/Auth/Login.tsx (本 task 改的实现)
//   frontend/apps/h5/src/pages/Auth/sanitizeRedirect.ts (本 task 新建 util)
//
// 5 testcase per inflight scope_in #8 (a)-(e):
//   (a) redirect_query_renders_hint → ?redirect=%2Freview%2Fexec%2F123
//       expect p00-redirect-hint visible + 文本含 '/review/exec/123' (path-only · 脱敏)
//   (b) no_redirect_no_hint → /auth/login (无 query)
//       expect p00-redirect-hint NOT in DOM (querySelector === null)
//   (c) login_success_replaces_to_redirect → 真后端 login + sanitize 通过
//       expect 最终 URL === '/review/exec/123' (NOT '/home')
//   (d) login_failure_keeps_redirect → 错密码
//       expect URL 仍含 ?redirect=%2Freview%2Fexec%2F123 + error toast 可见
//   (e) open_redirect_blocked → 4 子断言:
//       (e1) ?redirect=https://evil.com/steal → / · expect URL === /home + console.warn
//       (e2) ?redirect=javascript:alert(1) → URL ban (非 / 开头) + warn
//       (e3) ?redirect=data:text/html,xxx → URL ban + warn
//       (e4) ?redirect=//evil.com/x → protocol-relative ban + warn
//
// 测试环境前置:
//   - vite dev server :5174 (pnpm -F h5 dev)
//   - auth-service :8091 (mvn -pl auth-service spring-boot:run · 真后端 · 不 mock)
//   - PG :15432 含 auth_user fixture (test@example.com / Test@1234)
//   - Redis :16379 refresh token 存储
//
// 反作弊红线 (与 PHASE-A-LOGIN-H5 login.spec.ts 一致):
//   - (a) (b) (e) 不 mock 任何 /api · 即便他们不真发 login 也保持 网真后端
//   - (c) (d) 真发 POST /api/auth/login · 不 mock
//   - 每 test 之前 reset auth_user fixture (UPDATE failed_attempts=0, status='ACTIVE')

import { test, expect, type Page } from '@playwright/test';
import { execSync } from 'node:child_process';

const FIXTURE_EMAIL = 'test@example.com';
const FIXTURE_PASSWORD = 'Test@1234';
const REDIRECT_TARGET_RAW = '/review/exec/123';
const REDIRECT_TARGET_ENCODED = encodeURIComponent(REDIRECT_TARGET_RAW);

const TID = {
  root: 'p00-root',
  email: 'p00-email-input',
  password: 'p00-password-input',
  consentCheckbox: 'p00-consent-bar-checkbox',
  loginBtn: 'p00-login-submit-btn',
  errorInline: 'p00-error-inline',
  redirectHint: 'p00-redirect-hint',
  redirectBanner: 'p00-redirect-banner',
} as const;

/** Reset auth_user fixture between tests · 真 PG · 真 reset. */
function resetFixture(): void {
  execSync(
    `docker exec team-1-pg psql -U longfeng -d wrongbook -c "UPDATE auth_user SET status='ACTIVE', failed_attempts=0, locked_until=NULL WHERE email='${FIXTURE_EMAIL}';"`,
    { stdio: 'pipe' }
  );
}

async function tickConsent(page: Page): Promise<void> {
  await page.getByTestId(TID.consentCheckbox).click();
}

async function gotoLogin(page: Page, query: string = ''): Promise<void> {
  await page.goto(`/auth/login${query}`);
  await expect(page.getByTestId(TID.root)).toBeVisible();
}

test.describe('SC-00-T03 · P00 deeplink redirect roundtrip (5 cases)', () => {
  test.beforeEach(() => {
    resetFixture();
  });

  // ─── (a) redirect_query_renders_hint ──────────────────────────────────────
  test('TC-00.03 (a) redirect_query_renders_hint: ?redirect=/review/exec/123 → hint visible · text contains path-only (脱敏)', async ({ page }) => {
    await gotoLogin(page, `?redirect=${REDIRECT_TARGET_ENCODED}`);

    const hint = page.getByTestId(TID.redirectHint);
    await expect(hint).toBeVisible({ timeout: 5000 });
    await expect(hint).toContainText(REDIRECT_TARGET_RAW);
    // banner alias must also be visible (PHASE-A backward compat)
    await expect(page.getByTestId(TID.redirectBanner)).toBeVisible();
  });

  // ─── (b) no_redirect_no_hint ──────────────────────────────────────────────
  test('TC-00.03 (b) no_redirect_no_hint: /auth/login (无 query) → hint DOM 不存在', async ({ page }) => {
    await gotoLogin(page);

    // hint 不应渲染 — count 必须 === 0 (不是 hidden · 是不挂载)
    await expect(page.getByTestId(TID.redirectHint)).toHaveCount(0);
    await expect(page.getByTestId(TID.redirectBanner)).toHaveCount(0);
  });

  // ─── (c) login_success_replaces_to_redirect ───────────────────────────────
  test('TC-00.03 (c) login_success_replaces_to_redirect: 正确密码 → router.replace(/review/exec/123)', async ({ page }) => {
    await gotoLogin(page, `?redirect=${REDIRECT_TARGET_ENCODED}`);
    await tickConsent(page);
    await page.getByTestId(TID.email).fill(FIXTURE_EMAIL);
    await page.getByTestId(TID.password).fill(FIXTURE_PASSWORD);
    await page.getByTestId(TID.loginBtn).click();

    // 等待跳转 — 不经 /home 中转 · 直接到 /review/exec/123
    await page.waitForURL(/\/review\/exec\/123$/, { timeout: 10000 });
    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe(REDIRECT_TARGET_RAW);

    // 反向断言: URL 不能含 ?redirect= (replace 已消费完毕)
    expect(finalUrl.search).not.toContain('redirect');
    // 反向断言: 不经过 /home (URL pathname 不是 /home)
    expect(finalUrl.pathname).not.toBe('/home');

    // JWT 写入 localStorage 验证 login 真成功
    const jwt = await page.evaluate(() => window.localStorage.getItem('jwt'));
    expect(jwt).toBeTruthy();
    expect(jwt!.split('.').length).toBe(3);
  });

  // ─── (d) login_failure_keeps_redirect ─────────────────────────────────────
  test('TC-00.03 (d) login_failure_keeps_redirect: 错密码 → URL ?redirect= 保留 · error 可见', async ({ page }) => {
    await gotoLogin(page, `?redirect=${REDIRECT_TARGET_ENCODED}`);
    await tickConsent(page);
    await page.getByTestId(TID.email).fill(FIXTURE_EMAIL);
    await page.getByTestId(TID.password).fill('Wrong@Password1');
    await page.getByTestId(TID.loginBtn).click();

    // 等行内 error 出现 (后端 401 → FAILED state)
    await expect(page.getByTestId(TID.errorInline)).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId(TID.errorInline)).toContainText('邮箱或密码错误');

    // 关键: URL 仍含 ?redirect=<encoded> · 用户重试不丢失意图
    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe('/auth/login');
    expect(finalUrl.searchParams.get('redirect')).toBe(REDIRECT_TARGET_RAW);

    // 仍在 P00 (没被 router.replace 走)
    await expect(page.getByTestId(TID.root)).toBeVisible();
  });

  // ─── (e) open_redirect_blocked ────────────────────────────────────────────
  // 4 子断言: 外域 / javascript: / data: / protocol-relative
  test('TC-00.03 (e) open_redirect_blocked: 外域 + javascript: + data: + // → 一律 fallback /home + console.warn', async ({ page }) => {
    // 收集所有 console message (warn / error / log)
    const consoleEvents: Array<{ type: string; text: string }> = [];
    page.on('console', (msg) => {
      consoleEvents.push({ type: msg.type(), text: msg.text() });
    });

    const cases: Array<{ name: string; query: string; expectInUrl: string }> = [
      { name: 'e1-cross-origin', query: '?redirect=https%3A%2F%2Fevil.com%2Fsteal', expectInUrl: 'evil.com' },
      { name: 'e2-javascript', query: '?redirect=javascript%3Aalert(1)', expectInUrl: 'javascript' },
      { name: 'e3-data-url', query: '?redirect=data%3Atext%2Fhtml%2C%3Cscript%3Ealert(1)%3C%2Fscript%3E', expectInUrl: 'data' },
      { name: 'e4-protocol-relative', query: '?redirect=%2F%2Fevil.com%2Fx', expectInUrl: 'evil.com' },
    ];

    for (const c of cases) {
      // clear console events for this sub-case (we check warn fired during this load)
      const baselineLen = consoleEvents.length;

      await gotoLogin(page, c.query);
      await tickConsent(page);
      await page.getByTestId(TID.email).fill(FIXTURE_EMAIL);
      await page.getByTestId(TID.password).fill(FIXTURE_PASSWORD);
      await page.getByTestId(TID.loginBtn).click();

      // 期望 router.replace('/home') — 不是恶意 URL
      await page.waitForURL('**/home', { timeout: 10000 });
      const finalUrl = new URL(page.url());
      expect(finalUrl.pathname, `${c.name}: must fall back to /home`).toBe('/home');
      // 内部 host 不能含外域 token
      expect(finalUrl.host, `${c.name}: must stay on internal origin`).not.toContain('evil.com');

      // console.warn 必须有 [P00] redirect blocked 命中 (sanitizeRedirect 触发)
      const newWarns = consoleEvents
        .slice(baselineLen)
        .filter((e) => e.type === 'warning' || e.type === 'warn')
        .filter((e) => e.text.includes('[P00] redirect blocked'));
      expect(newWarns.length, `${c.name}: must emit [P00] redirect blocked warn`).toBeGreaterThan(0);

      // reset for next sub-case
      await page.evaluate(() => {
        window.localStorage.clear();
      });
      resetFixture();
    }

    // 反作弊: 整个测试期间不能有 console.error (audit dim_ide_smoke)
    const errors = consoleEvents.filter((e) => e.type === 'error');
    expect(errors, `console.error must be 0 during open-redirect sub-cases · got: ${errors.map(e => e.text).join(' | ')}`).toEqual([]);
  });
});
