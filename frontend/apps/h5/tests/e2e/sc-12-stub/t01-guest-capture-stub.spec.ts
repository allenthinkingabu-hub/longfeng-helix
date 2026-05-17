// ============================================================================
// SC-12-STUB-T01 · P-GUEST-CAPTURE 占位 stub 主 spec (4 testcase)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.2 P-GUEST-CAPTURE 规格卡 (stub 阶段约束)
//   biz §2B.12 F07A (P-LANDING「试试看」→ /guest/capture 入口 · SC-11-T04 已落)
//   frontend/apps/h5/src/pages/GuestCaptureStub/index.tsx (本 task 真页)
//   frontend/apps/h5/src/App.tsx (Route /guest/capture 新增行)
//
// 4 testcase per inflight scope_in 7 (a)-(d):
//   (a) stub_page_renders          → /guest/capture · stub root visible + 文字「游客试用功能开发中」
//   (b) cta_navigates_to_auth      → click CTA · expect /auth/login · 不出现 redirect query
//   (c) no_backend_calls (核心红线) → /api/guest/* + /api/ai/* + /api/file/* 累计 0 calls
//   (d) deeplink_direct_works      → 直接 page.goto · stub 仍 mount (不依赖 referer)
//
// 反作弊红线:
//   - 不用 page.evaluate 改组件 state · 走真 click + 真 navigate
//   - page.route 仅作 spy 计数 (audit dim 5 允许 · 不返业务 wire shape)
//   - 等待 mount + useEffect 后再断言 · 避免 race

import { test, expect, type Route } from '@playwright/test';

test.describe('SC-12-STUB-T01 · P-GUEST-CAPTURE 占位 stub 主 spec (4 cases)', () => {
  // ── (a) stub_page_renders ─────────────────────────────────────────────────
  test('TC-12-STUB-T01 (a) stub_page_renders: /guest/capture · root + 文字「游客试用功能开发中」visible', async ({
    page,
  }) => {
    await page.goto('/guest/capture');

    await expect(page.getByTestId('guest-capture-stub-root')).toBeVisible();
    // 文字断言 (用户视角看到的是这句 · 不只看 testid)
    await expect(page.getByText('游客试用功能开发中')).toBeVisible();
    // CTA 也要存在
    await expect(page.getByTestId('guest-capture-stub-cta')).toBeVisible();
    await expect(page.getByTestId('guest-capture-stub-cta')).toContainText(
      '立即注册',
    );
  });

  // ── (b) cta_navigates_to_auth ─────────────────────────────────────────────
  test('TC-12-STUB-T01 (b) cta_navigates_to_auth: click CTA → /auth/login · 不带 redirect query', async ({
    page,
  }) => {
    await page.goto('/guest/capture');
    await expect(page.getByTestId('guest-capture-stub-cta')).toBeVisible();

    await page.getByTestId('guest-capture-stub-cta').click();
    await page.waitForURL('**/auth/login**');

    const url = new URL(page.url());
    expect(url.pathname).toBe('/auth/login');
    // 不带 redirect query (注册后落 P-HOME 即可 · scope_in 1b)
    expect(url.searchParams.get('redirect')).toBeNull();
    expect(url.search).toBe('');
  });

  // ── (c) no_backend_calls (audit-gate 红线核心断言点) ───────────────────────
  test('TC-12-STUB-T01 (c) no_backend_calls: /api/guest/* + /api/ai/* + /api/file/* 累计 0 calls', async ({
    page,
  }) => {
    let guestApiCalls = 0;
    let aiApiCalls = 0;
    let fileApiCalls = 0;

    await page.route('**/api/guest/**', (route: Route) => {
      guestApiCalls += 1;
      route.fulfill({ status: 404, body: 'forbidden in stub phase' });
    });
    await page.route('**/api/ai/**', (route: Route) => {
      aiApiCalls += 1;
      route.fulfill({ status: 404, body: 'forbidden in stub phase' });
    });
    await page.route('**/api/file/**', (route: Route) => {
      fileApiCalls += 1;
      route.fulfill({ status: 404, body: 'forbidden in stub phase' });
    });

    await page.goto('/guest/capture');
    await expect(page.getByTestId('guest-capture-stub-root')).toBeVisible();

    // click CTA · 完整生命周期 (mount + click 都算) 后再断言
    await page.getByTestId('guest-capture-stub-cta').click();
    await page.waitForURL('**/auth/login**');

    // 给 mount + useEffect + navigate 后任何潜在异步 fetch 一点时间
    await page.waitForTimeout(500);

    expect(guestApiCalls).toBe(0);
    expect(aiApiCalls).toBe(0);
    expect(fileApiCalls).toBe(0);
  });

  // ── (d) deeplink_direct_works ─────────────────────────────────────────────
  test('TC-12-STUB-T01 (d) deeplink_direct_works: 直接 goto (无 referer) · stub 仍 mount', async ({
    page,
  }) => {
    // 模拟 deeplink/QR 直接跳进 (不来自 P-LANDING)
    // page.goto 默认无 Referer · 这就是 deeplink 场景
    await page.goto('/guest/capture');

    await expect(page.getByTestId('guest-capture-stub-root')).toBeVisible();
    await expect(page.getByText('游客试用功能开发中')).toBeVisible();

    // 验路由确实匹配 (不被通配 /* 兜底 Navigate to /)
    expect(new URL(page.url()).pathname).toBe('/guest/capture');
  });
});
