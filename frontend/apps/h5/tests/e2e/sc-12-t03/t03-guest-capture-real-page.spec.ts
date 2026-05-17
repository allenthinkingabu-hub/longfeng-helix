// ============================================================================
// SC-12-T03 · P-GUEST-CAPTURE 真页 主 spec (6 testcase)
// ============================================================================
//
// Source of truth (biz + design + code 三方拉齐):
//   biz §2A.3.2 P-GUEST-CAPTURE 规格卡 (顶部 quota + ConsentBar + Shutter)
//   biz §2B.13 SC-12 F01 (mount → POST /api/anon/session) + F02 (consent)
//   design/system/pages/P-GUEST-CAPTURE-guest-capture.spec.md §6 状态机
//   frontend/apps/h5/src/pages/GuestCapture/index.tsx (本 task 真页)
//   backend/anonymous-service AnonSessionController + AnonSessionConsentController
//
// 6 testcase per inflight scope_in 6 (a)-(f):
//   (a) page_mounts_and_calls_session_mint  → mount + sessionStorage anon_token/id
//   (b) consent_check_unlocks_shutter       → check checkbox · shutter unlock
//   (c) anon_session_id_stored_after_mint   → sessionStorage anon_session_id 数字
//   (d) login_cta_redirects_to_auth         → click loginBtn → /auth/login
//   (e) deeplink_direct_works               → goto 无 referer · 仍 mount
//   (f) consent_recheck_idempotent          → uncheck/check 两次 PATCH 都 200
//
// 反作弊红线:
//   - 严禁 page.evaluate 改组件 state · 真 click + fetch · 真后端 anonymous-service:8090
//   - 主 spec 不 page.route mock (走真 backend) · adversarial spec 才用 route 注 500
//   - 等 network /api/anon/session POST 200 后再断言 (避免 race)
//
// keywords: 真后端 · mint · consent · sessionStorage · React.StrictMode · 真 fetch

import { test, expect } from '@playwright/test';

test.describe('SC-12-T03 · P-GUEST-CAPTURE 真页 主 spec (6 cases · 真 anonymous-service)', () => {

  // ── (a) page_mounts_and_calls_session_mint ────────────────────────────────
  test('TC-12-T03 (a) page_mounts_and_calls_session_mint: mount → POST /api/anon/session 200 + UI 渲染 + sessionStorage 写入', async ({ page }) => {
    // 等待 POST /api/anon/session 真请求 (走 vite proxy → anonymous-service)
    const mintPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/anon/session') &&
        resp.url().match(/\/api\/anon\/session(\?|$)/) !== null &&
        resp.request().method() === 'POST',
      { timeout: 8000 },
    );

    await page.goto('/guest/capture');

    const mintResp = await mintPromise;
    expect(mintResp.status()).toBe(200);
    const mintBody = await mintResp.json();
    expect(mintBody.anonToken).toBeTruthy();
    expect(typeof mintBody.anonSessionId).toBe('number');
    expect(mintBody.anonSessionId).toBeGreaterThan(0);
    expect(mintBody.expiresAt).toBeTruthy();

    // UI 五件套 (spec §13)
    await expect(page.getByTestId('p-guest-capture-root')).toBeVisible();
    await expect(page.getByTestId('guest-shell-nav')).toBeVisible();
    await expect(page.getByTestId('guest-quota-banner')).toBeVisible();
    await expect(page.getByTestId('guest-quota-remaining')).toHaveText('1');
    await expect(page.getByTestId('guest-consent-card')).toBeVisible();
    await expect(page.getByTestId('guest-consent-checkbox')).not.toBeChecked();
    await expect(page.getByTestId('guest-shutter')).toBeDisabled();
    await expect(page.getByTestId('guest-camera-preview')).toBeVisible();

    // sessionStorage 真写入 (assertion 不 evaluate 改 state · 只读)
    const stored = await page.evaluate(() => ({
      token: sessionStorage.getItem('anon_token'),
      sessionId: sessionStorage.getItem('anon_session_id'),
    }));
    expect(stored.token).toBeTruthy();
    expect(stored.token).toMatch(/^eyJ/); // JWT format starts with eyJ (base64 {"alg":...)
    expect(stored.sessionId).toBeTruthy();
    expect(Number(stored.sessionId)).toBeGreaterThan(0);

    // data-phase=IDLE 确认状态机走对 (BOOTSTRAPPING → IDLE)
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'IDLE');
  });

  // ── (b) consent_check_unlocks_shutter ─────────────────────────────────────
  test('TC-12-T03 (b) consent_check_unlocks_shutter: click checkbox → PATCH consent 200 → shutter not disabled', async ({ page }) => {
    await page.goto('/guest/capture');

    // 等 mint 完成 · IDLE 之后再点 consent (避免 BOOTSTRAPPING 时 disabled)
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'IDLE', { timeout: 8000 });
    await expect(page.getByTestId('guest-shutter')).toBeDisabled();

    // 准备拦截 PATCH consent 响应 · 真 backend 返 200 + consentAt
    const consentPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/anon/session/') &&
        resp.url().includes('/consent') &&
        resp.request().method() === 'PATCH',
      { timeout: 5000 },
    );

    // 真 click checkbox (不 evaluate 改 state)
    await page.getByTestId('guest-consent-checkbox').check();

    const consentResp = await consentPromise;
    expect(consentResp.status()).toBe(200);
    const consentBody = await consentResp.json();
    expect(consentBody.consentAt).toBeTruthy();
    expect(consentBody.consentType).toBe(1);

    // 验请求 header 真带了 X-Anon-Token (T02 AnonFilter 要求)
    const consentReq = consentResp.request();
    expect(consentReq.headers()['x-anon-token']).toBeTruthy();

    // Shutter unlock
    await expect(page.getByTestId('guest-shutter')).not.toBeDisabled();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'CONSENT_PENDING');
  });

  // ── (c) anon_session_id_stored_after_mint ─────────────────────────────────
  test('TC-12-T03 (c) anon_session_id_stored_after_mint: sessionStorage anon_session_id 非空 + 数字 + 与 response 一致', async ({ page }) => {
    const mintPromise = page.waitForResponse(
      (resp) =>
        resp.url().match(/\/api\/anon\/session(\?|$)/) !== null &&
        resp.request().method() === 'POST',
      { timeout: 8000 },
    );

    await page.goto('/guest/capture');
    const mintResp = await mintPromise;
    const mintBody = await mintResp.json();

    // 等 IDLE (确保 setSession + sessionStorage.setItem 已跑完)
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'IDLE');

    const sessionId = await page.evaluate(() => sessionStorage.getItem('anon_session_id'));
    expect(sessionId).not.toBeNull();
    expect(sessionId).not.toBe('');
    expect(sessionId).not.toBe('null');
    expect(sessionId).not.toBe('undefined');
    expect(Number(sessionId)).toBeGreaterThan(0);
    // 与 response 内 anonSessionId 一致
    expect(sessionId).toBe(String(mintBody.anonSessionId));
  });

  // ── (d) login_cta_redirects_to_auth ───────────────────────────────────────
  test('TC-12-T03 (d) login_cta_redirects_to_auth: click loginBtn → URL pathname === /auth/login', async ({ page }) => {
    await page.goto('/guest/capture');
    await expect(page.getByTestId('guest-login-btn')).toBeVisible({ timeout: 8000 });

    await page.getByTestId('guest-login-btn').click();
    await page.waitForURL(/\/auth\/login/, { timeout: 3000 });

    const url = new URL(page.url());
    expect(url.pathname).toBe('/auth/login');
  });

  // ── (e) deeplink_direct_works ─────────────────────────────────────────────
  test('TC-12-T03 (e) deeplink_direct_works: 直接 goto /guest/capture (无 referer) · mint 仍成功 · root visible', async ({ page }) => {
    // 模拟 QR / deeplink 直跳 · page.goto 默认无 Referer = 真 deeplink 场景
    const mintPromise = page.waitForResponse(
      (resp) =>
        resp.url().match(/\/api\/anon\/session(\?|$)/) !== null &&
        resp.request().method() === 'POST',
      { timeout: 8000 },
    );

    await page.goto('/guest/capture');
    const mintResp = await mintPromise;
    expect(mintResp.status()).toBe(200);

    // 路由确实匹配 (不被 * → Navigate to / 兜底)
    expect(new URL(page.url()).pathname).toBe('/guest/capture');
    await expect(page.getByTestId('p-guest-capture-root')).toBeVisible();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'IDLE');
  });

  // ── (f) consent_recheck_idempotent ────────────────────────────────────────
  test('TC-12-T03 (f) consent_recheck_idempotent: check / uncheck / check 触发 2 次 PATCH 都 200 (T02 last-writer-wins)', async ({ page }) => {
    await page.goto('/guest/capture');
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'IDLE', { timeout: 8000 });

    const patchCalls: number[] = [];
    page.on('response', (resp) => {
      if (
        resp.url().includes('/api/anon/session/') &&
        resp.url().includes('/consent') &&
        resp.request().method() === 'PATCH'
      ) {
        patchCalls.push(resp.status());
      }
    });

    // 第 1 次 check → PATCH 1
    await page.getByTestId('guest-consent-checkbox').check();
    await expect(page.getByTestId('guest-shutter')).not.toBeDisabled();
    await expect(page.getByTestId('p-guest-capture-root')).toHaveAttribute('data-phase', 'CONSENT_PENDING');

    // uncheck → 不触发 PATCH (前端仅 setConsent · last-writer-wins 不需要回滚后端)
    await page.getByTestId('guest-consent-checkbox').uncheck();
    await expect(page.getByTestId('guest-shutter')).toBeDisabled();

    // 第 2 次 check → PATCH 2 · T02 last-writer-wins 保证返 200
    await page.getByTestId('guest-consent-checkbox').check();
    await expect(page.getByTestId('guest-shutter')).not.toBeDisabled();

    // 给最后一次 PATCH 落地一点时间 (response listener 异步收集)
    await page.waitForTimeout(500);

    // 至少 2 次 PATCH · 都 200 (idempotent)
    expect(patchCalls.length).toBeGreaterThanOrEqual(2);
    for (const status of patchCalls) {
      expect(status).toBe(200);
    }
  });
});
