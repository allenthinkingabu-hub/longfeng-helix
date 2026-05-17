// ============================================================================
// SC-12-T03 · P-GUEST-CAPTURE 真页 adversarial spec (3 cases · 探索性 + 破坏性)
// ============================================================================
//
// 探索性测试 (test-agent.md 铁律 3 严苛对抗 · CLAUDE.md Rule 9 Tests verify intent):
//   (a) mint_failure_shows_error_banner          — page.route 拦截 500 · errorBanner 出现
//   (b) shutter_disabled_when_consent_unchecked  — 不勾 consent · click shutter 不引发 navigate
//                                                   + 不调 /api/anon/file/presign (T04 端点 spy)
//   (c) double_mount_strict_mode_single_call     — React.StrictMode 双 mount 守护 · /api/anon/session
//                                                   只调 1 次 (useRef mintedRef 守门)
//
// 这里允许 page.route mock backend (audit 计数 ≤ 5) · 因为 adversarial 必须造网络故障 ·
// 主 spec 仍走真后端 · 不与"严禁 mock backend"红线冲突 (红线针对主 spec).
//
// keywords: 弱网降级 · React.StrictMode · sessionStorage 持久化 · API 端点 spy · 0 calls

import { test, expect, type Route } from '@playwright/test';

test.describe('SC-12-T03 · P-GUEST-CAPTURE 真页 adversarial (3 cases · 边界 + 降级)', () => {

  // ── (a) mint_failure_shows_error_banner ───────────────────────────────────
  test('ADV-T03 (a) mint_failure_shows_error_banner: POST /api/anon/session 500 → errorBanner visible + 文字含「初始化失败」', async ({ page }) => {
    // 拦截 mint endpoint · 返 500 模拟后端崩 (or 网络断)
    let mintAttempts = 0;
    await page.route('**/api/anon/session', (route: Route) => {
      mintAttempts += 1;
      if (route.request().method() === 'POST') {
        route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'INTERNAL_SERVER_ERROR' }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/guest/capture');

    // 等 phase → ERROR · 然后断言 errorBanner
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'ERROR', { timeout: 5000 });
    await expect(page.getByTestId('guest-error-banner')).toBeVisible();
    await expect(page.getByTestId('guest-error-banner')).toContainText('初始化失败');

    // Shutter + consent checkbox 都 disabled (phase=ERROR)
    await expect(page.getByTestId('guest-shutter')).toBeDisabled();
    await expect(page.getByTestId('guest-consent-checkbox')).toBeDisabled();

    // sessionStorage 不应写入 (失败路径)
    const stored = await page.evaluate(() => ({
      token: sessionStorage.getItem('anon_token'),
      sessionId: sessionStorage.getItem('anon_session_id'),
    }));
    expect(stored.token).toBeNull();
    expect(stored.sessionId).toBeNull();

    // mint 只发一次 (失败不重试 · 走 errorBanner 让用户刷新)
    expect(mintAttempts).toBe(1);
  });

  // ── (b) shutter_disabled_when_consent_unchecked ───────────────────────────
  test('ADV-T03 (b) shutter_disabled_when_consent_unchecked: 不勾 consent · click shutter · 不触发 navigation + 0 calls /api/anon/file/presign', async ({ page }) => {
    // T04 端点 spy · 不应该被调
    let presignCalls = 0;
    let questionsCalls = 0;
    await page.route('**/api/anon/file/**', (route: Route) => {
      presignCalls += 1;
      route.fulfill({ status: 404, body: 'forbidden in T03 phase' });
    });
    await page.route('**/api/anon/questions**', (route: Route) => {
      questionsCalls += 1;
      route.fulfill({ status: 404, body: 'forbidden in T03 phase' });
    });

    await page.goto('/guest/capture');
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'IDLE', { timeout: 8000 });

    // consent 未勾 · shutter disabled
    await expect(page.getByTestId('guest-consent-checkbox')).not.toBeChecked();
    await expect(page.getByTestId('guest-shutter')).toBeDisabled();

    // 即便用力 click shutter (Playwright 默认遵守 disabled 拒点 · 但用户视角点 disabled
    // 按钮不应触发 navigation / 任何 API 调用) · 用 force 模拟"用户狂点 disabled" 边界
    await page.getByTestId('guest-shutter').click({ force: true }).catch(() => { /* ignore · disabled */ });

    // 等 mount + click 后任何潜在异步 fetch 一点时间
    await page.waitForTimeout(500);

    // URL 不变 (没 navigate)
    expect(new URL(page.url()).pathname).toBe('/guest/capture');

    // T04 端点 0 calls
    expect(presignCalls).toBe(0);
    expect(questionsCalls).toBe(0);
  });

  // ── (c) double_mount_strict_mode_single_call ──────────────────────────────
  test('ADV-T03 (c) double_mount_strict_mode_single_call: React 多次 effect 触发 · /api/anon/session 真请求只 1 次 (useRef mintedRef 守门)', async ({ page }) => {
    let mintCallCount = 0;
    await page.route('**/api/anon/session', (route: Route) => {
      if (route.request().method() === 'POST') {
        mintCallCount += 1;
        // 真返回与 backend 同 shape · 让 frontend 状态机走对
        route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            anonToken: 'mock-jwt-token-for-double-mount-test',
            anonSessionId: 99999,
            expiresAt: '2027-01-01T00:00:00Z',
          }),
        });
      } else {
        route.continue();
      }
    });

    await page.goto('/guest/capture');
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'IDLE', { timeout: 8000 });

    // 等额外 1s · 给任何潜在 StrictMode 双 effect 时间
    await page.waitForTimeout(1000);

    // mint 仅 1 次 (useRef mintedRef guard) · 即便 React 18 dev 双 mount 也只发 1 次
    expect(mintCallCount).toBe(1);

    // sessionStorage 写入正确 (mock 值)
    const token = await page.evaluate(() => sessionStorage.getItem('anon_token'));
    expect(token).toBe('mock-jwt-token-for-double-mount-test');
  });
});
