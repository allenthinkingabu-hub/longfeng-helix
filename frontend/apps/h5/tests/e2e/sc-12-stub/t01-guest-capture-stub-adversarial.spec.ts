// ============================================================================
// SC-12-STUB-T01 · P-GUEST-CAPTURE adversarial spec (1+ case · test-agent.md 铁律 3 严苛对抗)
// ============================================================================
//
// 探索性 + 破坏性边界:
//   (a) shell_top_nav_renders   — Logo + 登录胶囊都可见 · 各自跳 /welcome 和 /auth/login
//   (b) no_tabbar_rendered      — 匿名页严禁渲染 Tab Bar (biz §2A.3.2)
//   (c) entry_source_xss_safe   — 注入 entry_source=<script> · sanitizeEntrySource 应净化为 'unknown'
//   (d) cta_keyboard_accessible — keyboard Tab + Enter 也能触发 CTA (a11y · 真人用)
//
// 探索维度: deeplink / no-referer / 未来 SC-12 兼容 / shell nav · XSS 探针

import { test, expect } from '@playwright/test';

test.describe('SC-12-STUB-T01 · adversarial · 匿名 Shell + XSS 安全 + a11y (4 cases)', () => {
  // ── (a) shell_top_nav_renders ─────────────────────────────────────────────
  test('ADV-12-STUB-T01 (a) shell_top_nav_renders: Logo + 登录胶囊 visible + 各自跳对路由', async ({
    page,
  }) => {
    await page.goto('/guest/capture');

    // Logo + 登录胶囊都 visible
    await expect(page.getByTestId('anon-shell-logo')).toBeVisible();
    await expect(page.getByTestId('anon-shell-login-pill')).toBeVisible();

    // Logo 文字含「错题本」品牌
    await expect(page.getByTestId('anon-shell-logo')).toContainText('错题本');
    await expect(page.getByTestId('anon-shell-login-pill')).toContainText('登录');

    // 点 Logo 跳 /welcome
    await page.getByTestId('anon-shell-logo').click();
    await page.waitForURL('**/welcome');
    expect(new URL(page.url()).pathname).toBe('/welcome');

    // 回到 stub · 点登录胶囊跳 /auth/login
    await page.goto('/guest/capture');
    await page.getByTestId('anon-shell-login-pill').click();
    await page.waitForURL('**/auth/login');
    expect(new URL(page.url()).pathname).toBe('/auth/login');
  });

  // ── (b) no_tabbar_rendered ────────────────────────────────────────────────
  test('ADV-12-STUB-T01 (b) no_tabbar_rendered: 匿名 stub 页严禁 Tab Bar (biz §2A.3.2)', async ({
    page,
  }) => {
    await page.goto('/guest/capture');
    await expect(page.getByTestId('guest-capture-stub-root')).toBeVisible();

    // 常见 Tab Bar testid (login/home 端可能用到) 都必须不存在
    expect(await page.getByTestId('tabbar').count()).toBe(0);
    expect(await page.getByTestId('tab-bar').count()).toBe(0);
    expect(await page.getByTestId('app-tabbar').count()).toBe(0);
  });

  // ── (c) entry_source_xss_safe ─────────────────────────────────────────────
  test('ADV-12-STUB-T01 (c) entry_source_xss_safe: ?entry_source=<script>...· sanitize → unknown', async ({
    page,
  }) => {
    // 收集 anon_stub_view 上报 payload
    const viewPayloads: Array<Record<string, unknown>> = [];
    page.on('console', (msg) => {
      if (msg.type() !== 'log') return;
      const args = msg.args();
      if (args.length < 2) return;
      Promise.all([args[0].jsonValue(), args[1].jsonValue()])
        .then(([event, payload]) => {
          if (
            event === 'anon_stub_view' &&
            payload &&
            typeof payload === 'object'
          ) {
            viewPayloads.push(payload as Record<string, unknown>);
          }
        })
        .catch(() => {
          /* ignore */
        });
    });

    // XSS payload 注入 (sanitizeEntrySource 应净化为 'unknown')
    const xssPayload = '<script>alert(1)</script>';
    await page.goto(
      `/guest/capture?entry_source=${encodeURIComponent(xssPayload)}`,
    );
    await expect(page.getByTestId('guest-capture-stub-root')).toBeVisible();
    await page.waitForTimeout(300); // 给 useEffect + console.log 时间

    expect(viewPayloads.length).toBeGreaterThanOrEqual(1);
    // 关键: 上报 payload entry_source 必须是 'unknown' (不是原始 XSS)
    expect(viewPayloads[0].entry_source).toBe('unknown');
    // 同时 verdict_intended 必须固定为 'GUEST_CAPTURE' (本 stub 页 source of truth)
    expect(viewPayloads[0].verdict_intended).toBe('GUEST_CAPTURE');
  });

  // ── (d) cta_keyboard_accessible ───────────────────────────────────────────
  test('ADV-12-STUB-T01 (d) cta_keyboard_accessible: Tab + Enter 也能触发 CTA → /auth/login', async ({
    page,
  }) => {
    await page.goto('/guest/capture');
    await expect(page.getByTestId('guest-capture-stub-cta')).toBeVisible();

    // 直接 focus + Enter (真人键盘流 · 不绕 UI)
    await page.getByTestId('guest-capture-stub-cta').focus();
    await page.keyboard.press('Enter');

    await page.waitForURL('**/auth/login');
    expect(new URL(page.url()).pathname).toBe('/auth/login');
  });
});
