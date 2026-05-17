// ============================================================================
// SC-00-T01 · resolve-entry · Playwright E2E (4 testcase)
// ============================================================================
//
// Source of truth:
//   biz §2A.3.1  决策节点细则表 (3 节点)
//   biz §2B.1a   SC-00 关键断言点 5 条
//   biz §10.6    POST /api/session/resolve 接口契约 (decision 6 枚举)
//   frontend/apps/h5/src/bootstrap/resolve-entry.ts (我们刚写的实现)
//
// 4 testcase per inflight scope_in #13:
//   (a) jwt_local_valid_no_resolve_call
//       → localStorage.jwt = valid (exp future, iss=longfeng, aud=h5)
//       → goto '/' → expect '/home' AND resolve API call count === 0
//   (b) no_jwt_resolve_returns_landing
//       → localStorage cleared → backend resolve returns LANDING → expect '/welcome'
//   (c) jwt_expired_resolve_returns_login
//       → localStorage.jwt = expired → mocked resolve returns LOGIN
//       → expect '/auth/login?redirect=<encoded>'
//   (d) resolve_500_offline_with_stale_jwt
//       → resolve route returns 500 → stale JWT (expired within 7d)
//       → expect '/home' (stale-tolerance fallback, NOT '/welcome')
//
// 设计决策:
//   - (a)(c)(d) 用 page.route() 拦截 + localStorage 预置 → 不依赖真后端
//   - (b) 跑真后端 (anonymous-service:8090 + auth-service:8091 + vite:5174)
//   - JWT 用 base64url 拼装 (无签名 · 前端只 decode 不 verify · 测试 HS256 secret 不放前端的安全模型)
// ============================================================================

import { test, expect, type Route } from '@playwright/test';

// ─── JWT helpers (no signing, since front-end never verifies) ────────────────
function b64url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=+$/, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function makeJwt(payload: Record<string, unknown>): string {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify(payload));
  // signature is a placeholder — front-end uses jose.decodeJwt() (no verify).
  // Back-end is a different story: real signatures are required when hitting
  // any authenticated endpoint, but resolve-entry's local pre-judge never asks
  // the back-end when the JWT looks locally valid.
  const sig = b64url('placeholder-not-verified-by-frontend');
  return `${header}.${body}.${sig}`;
}

const nowSec = () => Math.floor(Date.now() / 1000);

// ─── Test fixtures ───────────────────────────────────────────────────────────
test.describe('SC-00-T01 · resolve-entry · bootstrap decision tree dispatch', () => {

  // (a) ──────────────────────────────────────────────────────────────────────
  test('TC-00-A · jwt_local_valid_no_resolve_call → /home AND 0 backend call', async ({ page }) => {
    // Spy on every /api/session/resolve call (must remain 0).
    let resolveCallCount = 0;
    await page.route('**/api/session/resolve', (route: Route) => {
      resolveCallCount += 1;
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decision: 'LANDING' }),
      });
    });

    // Seed localStorage BEFORE app boot — needs an init script.
    const validJwt = makeJwt({
      sub: 'u-1',
      exp: nowSec() + 3600,
      iss: 'longfeng',
      aud: 'h5',
    });
    await page.addInitScript((jwt: string) => {
      window.localStorage.setItem('jwt', jwt);
    }, validJwt);

    await page.goto('/');

    // BootstrapGate should redirect to /home synchronously after resolveEntry().
    await page.waitForURL('**/home', { timeout: 5000 });
    expect(page.url()).toMatch(/\/home$/);

    // 关键断言: 整个 bootstrap 没有调过 /api/session/resolve
    expect(resolveCallCount, 'local JWT valid must short-circuit backend resolve').toBe(0);
  });

  // (b) ──────────────────────────────────────────────────────────────────────
  test('TC-00-B · no_jwt_resolve_returns_landing → /welcome (真后端打通)', async ({ page }) => {
    // No localStorage seeding — clean slate triggers backend resolve.
    await page.addInitScript(() => {
      window.localStorage.clear();
    });

    await page.goto('/');

    // Real anonymous-service should return LANDING (decision tree node 3 P0 short-circuit).
    await page.waitForURL('**/welcome', { timeout: 8000 });
    expect(page.url()).toMatch(/\/welcome$/);

    // Placeholder testid (per scope_in #5 + #6) must render to prove we landed.
    await expect(page.getByTestId('landing-placeholder-root')).toBeVisible();
  });

  // (c) ──────────────────────────────────────────────────────────────────────
  test('TC-00-C · jwt_expired_resolve_returns_login → /auth/login?redirect=...', async ({ page }) => {
    // Expired JWT — passes localStorage existence but fails exp check.
    const expiredJwt = makeJwt({
      sub: 'u-1',
      exp: nowSec() - 3600,       // 1h ago
      iss: 'longfeng',
      aud: 'h5',
    });
    await page.addInitScript((jwt: string) => {
      window.localStorage.setItem('jwt', jwt);
    }, expiredJwt);

    // Mock backend → LOGIN
    await page.route('**/api/session/resolve', (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ decision: 'LOGIN', maskedAccount: 'a***@example.com' }),
      });
    });

    await page.goto('/');

    await page.waitForURL(/\/auth\/login\?redirect=/, { timeout: 8000 });
    const finalUrl = new URL(page.url());
    expect(finalUrl.pathname).toBe('/auth/login');
    const redirect = finalUrl.searchParams.get('redirect');
    expect(redirect, 'redirect= must encode original URL').toBeTruthy();
    // The original path was '/' so the encoded redirect should decode back to '/'.
    expect(decodeURIComponent(redirect ?? '')).toBe('/');
  });

  // (d) ──────────────────────────────────────────────────────────────────────
  test('TC-00-D · resolve_500_offline_with_stale_jwt → /home (stale tolerance)', async ({ page }) => {
    // Stale JWT — expired 1d ago (well within the 7d tolerance window).
    const staleJwt = makeJwt({
      sub: 'u-1',
      exp: nowSec() - 24 * 60 * 60,
      iss: 'longfeng',
      aud: 'h5',
    });
    await page.addInitScript((jwt: string) => {
      window.localStorage.setItem('jwt', jwt);
    }, staleJwt);

    // Backend returns 500 → resolveEntry must catch + fall back to stale-tolerance.
    await page.route('**/api/session/resolve', (route: Route) => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'simulated_outage' }),
      });
    });

    await page.goto('/');

    await page.waitForURL('**/home', { timeout: 8000 });
    expect(page.url()).toMatch(/\/home$/);
  });
});
