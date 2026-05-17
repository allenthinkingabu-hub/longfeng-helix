// ============================================================================
// SC-00-T01 · resolve-entry · Adversarial / 破坏性边界用例 (Tester 探索性)
// ============================================================================
//
// 在 Coder 的 4 testcase 上 + 4 条破坏性边界 (test-agent.md 铁律 3 严苛对抗):
//   ADV-1 · /s/<deeplink> 同时 localStorage 有 valid JWT → 必须仍调后端
//           (forceBackend 优先级 > 本地命中 · 否则 share-token 流程被绕)
//   ADV-2 · resolve 响应 schema 篡改 (decision='WTF') → zod parse 应 reject + fallback LANDING
//   ADV-3 · resolve 慢响应 (5s+1ms · 应触发 AbortController timeout → fallback path)
//   ADV-4 · JWT 篡改 (前 8 字符替换成 garbage) → decodeJwt 抛 → 当本地无 JWT 处理 → 调后端
//
// 关键: 这些是 Coder spec 没覆盖的边界 · 全部由真后端 + page.route 混合验证 · 不动生产代码
// (除非发现真 bug)。
// ============================================================================

import { test, expect, type Route } from '@playwright/test';

function b64url(input: string | Buffer): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}
function makeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  return `${header}.${body}.${b64url('placeholder')}`;
}
const nowSec = () => Math.floor(Date.now() / 1000);

test.describe('SC-00-T01 · ADVERSARIAL · 破坏性边界', () => {

  test('ADV-1 · /s/<deeplink> + valid local JWT → 占位页直接渲染 · BootstrapGate 跳过 (T04 占位页负责调后端)', async ({ page }) => {
    // 攻击场景: 用户已登录 (有 valid JWT) 但点开了 share-token deeplink
    // 设计: BootstrapGate.BOOTSTRAP_PATHS 仅含 ['/','/home','/auth/login'] · /s/* 不拦截
    //       SharedStub 占位页 onMount 自己调后端 (T04 实现 · 本 task 占位)
    // 期望: 占位页渲染 + 保留 /s/:token URL · 不被 valid JWT 偷偷打回 /home
    const validJwt = makeJwt({ sub: 'u-1', exp: nowSec() + 3600, iss: 'longfeng', aud: 'h5' });
    await page.addInitScript((jwt: string) => {
      window.localStorage.setItem('jwt', jwt);
    }, validJwt);

    await page.goto('/s/ABC-SHARE-TOKEN-123');

    // 关键断言: 即使有 valid JWT · URL 必须仍是 /s/:token (BootstrapGate 不抢)
    expect(page.url(), 'BootstrapGate must NOT hijack share-deeplink to /home').toMatch(/\/s\/ABC-SHARE-TOKEN-123/);
    // 占位页 testid 渲染 (P-SHARED 占位)
    await expect(page.getByTestId('shared-placeholder-root')).toBeVisible();
  });

  test('ADV-2 · resolve schema 篡改 (decision="WTF") → zod reject + fallback /welcome', async ({ page }) => {
    let consoleErrorCount = 0;
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrorCount += 1;
    });

    await page.route('**/api/session/resolve', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decision: 'WTF_INVALID_ENUM' }),  // 故意非法
      });
    });

    await page.addInitScript(() => window.localStorage.clear());

    await page.goto('/');

    // 应 fallback /welcome (无 JWT · resolve schema 错 → catch → 无 stale JWT → /welcome)
    await page.waitForURL('**/welcome', { timeout: 8000 });
    expect(page.url()).toMatch(/\/welcome$/);
    // 也应 console.error (resolve-entry.ts callResolve 在 schema 错时打了 error)
    expect(consoleErrorCount, 'schema mismatch must surface a console error (no silent fail)').toBeGreaterThanOrEqual(1);
  });

  test('ADV-3 · resolve 慢响应 6s → 5s timeout → 无 JWT fallback /welcome', async ({ page }) => {
    await page.route('**/api/session/resolve', async (route: Route) => {
      // 模拟极慢网络: 6s 才回 200
      await new Promise((r) => setTimeout(r, 6000));
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decision: 'HOME' }),  // 即使最终是 HOME · 也来得太晚
      });
    });

    await page.addInitScript(() => window.localStorage.clear());

    await page.goto('/');

    // 应在 5s 后 abort → catch → 无 JWT → /welcome (不能因为 backend 迟到的 HOME 偷偷夺权)
    await page.waitForURL('**/welcome', { timeout: 9000 });
    expect(page.url()).toMatch(/\/welcome$/);
  });

  test('ADV-4 · JWT 前缀篡改 → decodeJwt 抛 → 当本地无 JWT 处理 → 调后端', async ({ page }) => {
    let resolveCallCount = 0;
    await page.route('**/api/session/resolve', (route: Route) => {
      resolveCallCount += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decision: 'LANDING' }),
      });
    });

    const validJwt = makeJwt({ sub: 'u-1', exp: nowSec() + 3600, iss: 'longfeng', aud: 'h5' });
    const tamperedJwt = 'GARBAGE!' + validJwt.slice(8);

    await page.addInitScript((jwt: string) => {
      window.localStorage.setItem('jwt', jwt);
    }, tamperedJwt);

    await page.goto('/');

    // decodeJwt 抛 → isLocallyValid false → 调后端 (返 LANDING) → /welcome
    await page.waitForURL('**/welcome', { timeout: 8000 });
    expect(resolveCallCount, 'tampered JWT must NOT short-circuit to HOME · must call backend').toBeGreaterThanOrEqual(1);
  });
});
