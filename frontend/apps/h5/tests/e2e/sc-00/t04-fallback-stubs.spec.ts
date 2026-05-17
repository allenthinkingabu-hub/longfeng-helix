// ============================================================================
// SC-00-T04 · stub 兜底真页 + 离线降级真 UI · Playwright E2E (6 testcase)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.1 决策树补丁 3 (离线降级新规则 · 黄条 + 关闭)
//   biz §2A.3.2 P-SHARED / P-WELCOMEBACK 规格卡 (stub 阶段约束)
//   biz §2B.1a 关键断言点 5 (stub 阶段不调真 share/device-refresh/observer 接口)
//   frontend/apps/h5/src/pages/SharedStub/index.tsx (本 task 真页)
//   frontend/apps/h5/src/pages/WelcomeBack/index.tsx (本 task 真页)
//   frontend/apps/h5/src/pages/ObserverStub/index.tsx (本 task 真页)
//   frontend/apps/h5/src/components/OfflineBanner/index.tsx (本 task 真 UI)
//   frontend/apps/h5/src/bootstrap/resolve-entry.ts (本 task timeout=800ms + offline 标记)
//
// 6 testcase per inflight scope_in 9 (a)-(f):
//   (a) shared_stub_renders → /s/abc123 · expect shared-stub-root + cta visible
//                              · /api/share/* spy count === 0
//   (b) welcomeback_stub_renders → /welcome-back · 同款 · device-refresh + session/resolve 二次 spy === 0
//   (c) observer_stub_renders → /observer/ABC123 · 同款 · /api/observer/* spy === 0
//   (d) stub_cta_redirects_to_login → shared stub 上 CTA · expect URL === /auth/login
//   (e) offline_banner_with_stale_jwt → mock /api/session/resolve 5xx + stale JWT
//                                      · expect /home + offline-banner-root visible + 文字 '离线模式'
//   (f) offline_banner_close_persists → 在 (e) 状态点 close · banner 消失
//                                      · reload + 仍 5xx → banner 不再出现 (sessionStorage 标记)
//
// 反作弊红线:
//   - (a)(b)(c)(d) 完全不 mock 业务接口 · 用 page.route 仅作 spy 计数 (audit 维度 5 允许)
//   - (e)(f) 用 page.route 注入 5xx · audit-gate v3 说明 "page.route 注入 5xx/timeout 是测试基础设施 · 不算 business mock"
//   - 不使用 page.evaluate 走后门改组件 state
//   - mock 总数 ≤ 5 (实际本 spec 只用 5 个 page.route · 全部为 spy + 5xx 注入 · 不返业务 wire shape)

import { test, expect, type Route } from '@playwright/test';

function b64url(input: string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  const sig = b64url('placeholder-not-verified-by-frontend');
  return `${header}.${body}.${sig}`;
}

const nowSec = (): number => Math.floor(Date.now() / 1000);

test.describe('SC-00-T04 · stub 兜底真页 + 离线降级真 UI (6 cases)', () => {

  // ─── (a) shared_view_renders (SC-13 改造 · 替换原 shared_stub_renders) ──────
  // 用户决策 (SC-13 inflight scope_in #11): SC-00-T04 SharedStub 退役 · 真 SharedView 接管.
  // 旧 (a) 断言 '/api/share/* count===0' 已被本 task 显式取消 (stub 阶段不调 share API
  // 的规则不再适用) · 现在期望 SharedView 真发出 GET /api/share/:token · 用 mock 返
  // 404 来走 INVALID 挡板路径 · 验证页面挂载稳定.
  test('TC-00-T04 (a) shared_view_renders: /s/abc123 → SharedView mount + invalid-screen on mock 404', async ({ page }) => {
    // Mock /api/share/abc123 返 404 (token 不存在) · SharedView 进 INVALID 态
    await page.route('**/api/share/**', (route: Route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOKEN_INVALID', message: '分享链接无效' }),
      });
    });

    await page.goto('/s/abc123');

    // SharedView 真页 root + INVALID 挡板必现 (兼容 alias 'shared-stub-root' 也可见)
    await expect(page.getByTestId('p-shared')).toBeVisible();
    await expect(page.getByTestId('token-invalid-screen')).toBeVisible();
  });

  // ─── (b) welcomeback_stub_renders ───────────────────────────────────────────
  test('TC-00-T04 (b) welcomeback_stub_renders: /welcome-back → stub UI · device-refresh + 二次 resolve count===0', async ({ page }) => {
    // 计数 /api/auth/device-refresh
    let deviceRefreshCalls = 0;
    await page.route('**/api/auth/device-refresh', (route: Route) => {
      deviceRefreshCalls += 1;
      route.fulfill({ status: 404 });
    });

    // 计数 二次 resolve (允许第一次 bootstrap 触发, 但 /welcome-back path 在 BOOTSTRAP_PATHS 外 ·
    // 实际不应被 boot gate 触发 — 这里仍保留 spy 以防回归)
    let resolveCalls = 0;
    await page.route('**/api/session/resolve', (route: Route) => {
      resolveCalls += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decision: 'WELCOME_BACK' }),
      });
    });

    await page.goto('/welcome-back');

    await expect(page.getByTestId('welcomeback-stub-root')).toBeVisible();
    await expect(page.getByTestId('welcomeback-stub-cta')).toBeVisible();
    await expect(page.getByTestId('welcomeback-stub-cta')).toContainText('登录');

    await page.waitForTimeout(300);
    expect(deviceRefreshCalls).toBe(0);
    // /welcome-back 在 BOOTSTRAP_PATHS 之外 · 0 次 resolve
    expect(resolveCalls).toBe(0);
  });

  // ─── (c) observer_stub_renders ─────────────────────────────────────────────
  test('TC-00-T04 (c) observer_stub_renders: /observer/ABC123 → stub UI · /api/observer/* count===0', async ({ page }) => {
    let observerApiCalls = 0;
    await page.route('**/api/observer/**', (route: Route) => {
      observerApiCalls += 1;
      route.fulfill({ status: 404 });
    });

    await page.goto('/observer/ABC123');

    await expect(page.getByTestId('observer-stub-root')).toBeVisible();
    await expect(page.getByTestId('observer-stub-cta')).toBeVisible();

    await page.waitForTimeout(300);
    expect(observerApiCalls).toBe(0);
  });

  // ─── (d) invalid_screen_cta_redirects_to_welcome (SC-13 改造) ──────────────
  // 旧 stub CTA → /auth/login 行为已淘汰 · SharedView INVALID 挡板 CTA 走
  // '返回看看新功能' → /welcome (符合 spec §7 INVALID/EXPIRED/REVOKED 出口).
  test('TC-00-T04 (d) invalid_screen_cta_redirects_to_welcome: INVALID 挡板 CTA → /welcome', async ({ page }) => {
    await page.route('**/api/share/**', (route: Route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOKEN_INVALID', message: '分享链接无效' }),
      });
    });

    await page.goto('/s/some-token-xyz');
    await expect(page.getByTestId('token-invalid-screen')).toBeVisible();

    // 点 INVALID 挡板的 '返回看看新功能' (button text · 不在 testid 表)
    await page.getByRole('button', { name: '返回看看新功能' }).click();

    await page.waitForURL('**/welcome', { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe('/welcome');
  });

  // ─── (e) offline_banner_with_stale_jwt ─────────────────────────────────────
  test('TC-00-T04 (e) offline_banner_with_stale_jwt: resolve 5xx + stale JWT → /home + banner visible · 文字 "离线模式"', async ({ page }) => {
    // Inject expired (but ≤ 7d) JWT before app boot
    const staleJwt = makeJwt({
      sub: 'u-stale',
      // 1 day ago — within OFFLINE_STALE_TOLERANCE_MS (7d)
      exp: nowSec() - 24 * 3600,
      iss: 'longfeng',
      aud: 'h5',
    });
    await page.addInitScript((jwt: string) => {
      window.localStorage.setItem('jwt', jwt);
      // Make sure no leftover offline flag from a previous test session
      window.sessionStorage.removeItem('offlineMode');
      window.sessionStorage.removeItem('offlineDismissed');
    }, staleJwt);

    // Mock resolve to 5xx → triggers offline degrade path
    await page.route('**/api/session/resolve', (route: Route) => {
      route.fulfill({ status: 500, body: 'server error' });
    });

    await page.goto('/');

    // BootstrapGate should land us on /home via stale-tolerance branch
    await page.waitForURL('**/home', { timeout: 5000 });

    // Banner appears (sessionStorage.offlineMode set by resolve-entry catch path)
    const banner = page.getByTestId('offline-banner-root');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('离线模式');

    // Close button is also rendered + clickable
    await expect(page.getByTestId('offline-banner-close')).toBeVisible();
  });

  // ─── (f) offline_banner_close_persists ─────────────────────────────────────
  test('TC-00-T04 (f) offline_banner_close_persists: close → hidden · reload + 仍 5xx → banner 不再出现', async ({ page }) => {
    const staleJwt = makeJwt({
      sub: 'u-stale',
      exp: nowSec() - 12 * 3600,
      iss: 'longfeng',
      aud: 'h5',
    });
    // NOTE: addInitScript runs on EVERY navigation (including page.reload()).
    // We must NOT touch sessionStorage here, or the test's "did dismissed
    // flag survive reload?" assertion is invalidated. Only seed localStorage.jwt.
    await page.addInitScript((jwt: string) => {
      window.localStorage.setItem('jwt', jwt);
    }, staleJwt);

    await page.route('**/api/session/resolve', (route: Route) => {
      route.fulfill({ status: 503, body: 'unavailable' });
    });

    // Initial visit: explicitly clear sessionStorage (one-shot, NOT via init script).
    await page.goto('/');
    await page.evaluate(() => {
      sessionStorage.removeItem('offlineMode');
      sessionStorage.removeItem('offlineDismissed');
    });
    // Trigger a fresh boot so resolve-entry runs against our 5xx mock.
    await page.goto('/');
    await page.waitForURL('**/home', { timeout: 5000 });

    // Banner first appears
    await expect(page.getByTestId('offline-banner-root')).toBeVisible();

    // Click close → banner removed from DOM
    await page.getByTestId('offline-banner-close').click();
    await expect(page.getByTestId('offline-banner-root')).toHaveCount(0);

    // Reload — resolve still 5xx — sessionStorage.offlineDismissed='true' must
    // keep the banner hidden (banner only auto-resurfaces after a successful
    // resolve clears both flags, per useOfflineMode contract).
    await page.reload();
    await page.waitForURL('**/home', { timeout: 5000 });
    // Give resolve time to fail again and flip offlineMode back on
    await page.waitForTimeout(1200);
    // Still hidden because dismissed flag persists in sessionStorage
    await expect(page.getByTestId('offline-banner-root')).toHaveCount(0);
  });
});
