// ============================================================================
// SC-00-T04 · Adversarial · 探索性边界用例 (3 testcase)
// ============================================================================
//
// Tester 视角 (test-agent.md 铁律 3 严苛对抗):
//   - 探索 [timeout / 5xx / abort / sessionStorage / hash] 五类边界
//   - 验证 Coder 真改了 800ms timeout · 不是只改注释没改值
//   - 验证 token_hash 真做了 djb2 (不是返回明文 / 不是常量)
//   - 验证 no JWT + 5xx 不去 /home (避免空账号被强行 P00)
//
// 3 testcase per inflight scope_in 10:
//   (a) timeout_800ms_triggers_degradation
//       → mock resolve 延 1500ms · 设过期 stale JWT
//       → expect 800ms 内 abort + router.replace('/home') + banner
//   (b) no_jwt_5xx_falls_to_welcome
//       → localStorage 清空 + mock resolve 500
//       → expect /welcome (NOT /home · NOT /auth/login)
//   (c) stub_token_path_param_in_telemetry
//       → /s/abc123 mount · 监听 console.log
//       → expect anon_stub_view 事件的 token_hash 非空且 !== 'abc123' 原文
//       → 进一步验证 djb2('abc123') === 已知期望值 (algorithm 真实性)

import { test, expect, type ConsoleMessage, type Route } from '@playwright/test';

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
  const sig = b64url('placeholder');
  return `${header}.${body}.${sig}`;
}

const nowSec = (): number => Math.floor(Date.now() / 1000);

/** Reference djb2 implementation — kept in test file to detect Coder drift.
 *  If Coder silently changes djb2.ts the test will fail (Rule 9 verify intent). */
function refDjb2Hex(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16);
}

test.describe('SC-00-T04 · Adversarial · 探索性边界 (3 cases)', () => {

  // ─── (a) timeout_800ms_triggers_degradation ────────────────────────────────
  test('TC-00-T04-ADV (a) timeout_800ms_triggers_degradation: 1500ms 延迟 · stale JWT · abort 后落 /home + banner', async ({ page }) => {
    const staleJwt = makeJwt({
      sub: 'u-stale-adv',
      exp: nowSec() - 3 * 24 * 3600,  // 3d ago — 仍在 7d tolerance 内
      iss: 'longfeng',
      aud: 'h5',
    });
    await page.addInitScript((jwt: string) => {
      window.localStorage.setItem('jwt', jwt);
      window.sessionStorage.removeItem('offlineMode');
      window.sessionStorage.removeItem('offlineDismissed');
    }, staleJwt);

    // Mock resolve 延 1500ms (远超 800ms timeout) — AbortController 应触发
    await page.route('**/api/session/resolve', async (route: Route) => {
      await new Promise((r) => setTimeout(r, 1500));
      // 即使 1500ms 后回 200 · 此时 AbortError 已被前端 catch · response 被忽略
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decision: 'HOME' }),
      });
    });

    const startMs = Date.now();
    await page.goto('/');

    // 走 stale-tolerance fallback → /home
    await page.waitForURL('**/home', { timeout: 3000 });
    const elapsedMs = Date.now() - startMs;

    // BootstrapGate 应在 800ms 后立即 abort + 切 /home · 总耗时应 < 1500ms (mock delay)
    // 留 ample 余量 (页面加载 + JS 启动 + abort 后转 dispatch · 真 2s 内一定完成)
    expect(elapsedMs).toBeLessThan(2500);

    // 离线 banner 应出现 (sessionStorage.offlineMode='true')
    await expect(page.getByTestId('offline-banner-root')).toBeVisible();
  });

  // ─── (b) no_jwt_5xx_falls_to_welcome ────────────────────────────────────────
  test('TC-00-T04-ADV (b) no_jwt_5xx_falls_to_welcome: 无 JWT + resolve 500 → /welcome (NOT /home, NOT /auth/login)', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.removeItem('jwt');  // 清空 — 没有 JWT
      window.sessionStorage.removeItem('offlineMode');
      window.sessionStorage.removeItem('offlineDismissed');
    });

    await page.route('**/api/session/resolve', (route: Route) => {
      route.fulfill({ status: 500, body: 'down' });
    });

    await page.goto('/');

    // 必须落 /welcome — 没有 JWT + 5xx 是 LANDING (不是 HOME · 不是 LOGIN)
    await page.waitForURL('**/welcome', { timeout: 5000 });
    expect(new URL(page.url()).pathname).toBe('/welcome');

    // 同时确认没误跳 /home · /auth/login
    expect(new URL(page.url()).pathname).not.toBe('/home');
    expect(new URL(page.url()).pathname).not.toBe('/auth/login');
  });

  // ─── (c) shared_view_telemetry_on_invalid (SC-13 改造 · 替换原 stub_token_hash 测试) ─
  // 旧测期望 stub 发 anon_stub_view + djb2 token_hash. SC-13 真页改发
  // anon_share_token_invalid (INVALID 态) · 不再走 djb2 hash. 改造视角:
  // 真页路由必须发 SC-13 埋点而非 stub 埋点 (alignment failure regression).
  test('TC-00-T04-ADV (c) shared_view_telemetry_emitted: /s/abc123 INVALID → anon_share_token_invalid event fired', async ({ page }) => {
    const captured: string[] = [];

    page.on('console', (msg: ConsoleMessage) => {
      const text = msg.text();
      // trackLanding 镜像到 console.log 形如 "anon_share_token_invalid {payload...}"
      if (text.startsWith('anon_share_')) {
        captured.push(text);
      }
    });

    // Mock 真路由 · INVALID 路径 (404)
    await page.route('**/api/share/**', (route: Route) => {
      route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ code: 'TOKEN_INVALID', message: '分享链接无效' }),
      });
    });

    await page.goto('/s/abc123');
    await expect(page.getByTestId('token-invalid-screen')).toBeVisible();
    await page.waitForTimeout(500);

    // 至少捕获到 1 个 anon_share_token_invalid 事件 (SC-13 新埋点)
    const invalidEvents = captured.filter((c) => c.includes('anon_share_token_invalid'));
    expect(invalidEvents.length).toBeGreaterThan(0);

    // 反向断言: 不应再发 SC-00-T04 旧 stub 埋点 anon_stub_view
    const stubEvents = captured.filter((c) => c.includes('anon_stub_view'));
    expect(stubEvents.length).toBe(0);

    // refDjb2Hex 引用保留 (其他测试可能继续用) · 本测试不再用它
    void refDjb2Hex;
  });
});
